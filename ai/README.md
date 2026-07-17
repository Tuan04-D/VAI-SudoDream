# AI cảnh báo thời tiết và sạt lở cho Điện Biên

Nguyên mẫu này nhận tên một xã/phường ở Điện Biên, lấy dự báo thời tiết theo tọa
độ và cảnh báo sạt lở/lũ quét, sau đó để LLM viết bản tin tiếng Việt ngắn, dễ hiểu.
Phần gửi Zalo/SMS/loa công cộng và dịch tiếng Thái/Mông **chưa được triển khai**.

## Thành phần

- `app/tools/landslide.py`: đọc endpoint công khai của [hệ thống cảnh báo lũ quét,
  sạt lở đất NCHMF](https://luquetsatlo.nchmf.gov.vn/), lọc Điện Biên, gộp bản ghi
  trùng theo xã mới và giữ mức nguy cơ cao nhất.
- `app/tools/weather.py`: tìm tọa độ (ưu tiên dữ liệu NCHMF, sau đó Open-Meteo và
  OpenStreetMap Nominatim), lấy dự báo Open-Meteo và gom thành từng khoảng 6 giờ.
- `app/agent.py`: OpenAI Responses API + function calling. Agent phải gọi cả hai
  tool trước khi viết bản tin.
- `app/api.py`: API FastAPI và scheduler cập nhật dữ liệu sạt lở mỗi 6 giờ.
- `app/cli.py`: chạy nhanh từ terminal; có chế độ raw không cần OpenAI key.

## Cài đặt

Yêu cầu Python 3.10 trở lên.

```powershell
cd ai
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Mở file `.env` và điền key:

```dotenv
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.6
LANDSLIDE_REFRESH_HOURS=6
HTTP_TIMEOUT_SECONDS=30
```

`.env` đã nằm trong `.gitignore`; không commit key lên Git. Có thể đổi model bằng
`OPENAI_MODEL` mà không sửa mã nguồn.

## Chạy bằng CLI

Kiểm tra hai nguồn dữ liệu mà **không gọi LLM**:

```powershell
python -m app.cli "Tủa Chùa" --days 3 --raw
```

Tạo bản tin qua OpenAI:

```powershell
python -m app.cli "Tủa Chùa" --days 3
```

Nếu bộ tìm địa danh không nhận ra một xã, truyền tọa độ để tránh chọn nhầm:

```powershell
python -m app.cli "Xã cần tra" --latitude 21.90 --longitude 103.40 --raw
```

## Chạy API

```powershell
uvicorn app.api:app --host 0.0.0.0 --port 8000 --reload
```

Swagger UI: `http://localhost:8000/docs`

`0.0.0.0` chỉ dùng cho tham số `--host` để server lắng nghe mọi interface, không
phải địa chỉ mở trên trình duyệt. Khi chạy local, mở `http://127.0.0.1:8000/docs`
hoặc `http://localhost:8000/docs`.

Tạo bản tin:

```powershell
curl.exe -X POST "http://localhost:8000/api/v1/advisories" `
  -H "Content-Type: application/json" `
  -d '{"commune":"Tủa Chùa","days":3}'
```

Các endpoint hữu ích:

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/health` | Kiểm tra server và việc cấu hình key |
| `POST` | `/api/v1/advisories` | Chạy agent, trả bản tin và dữ liệu nguồn |
| `GET` | `/api/v1/landslides?commune=Tủa Chùa` | Chỉ đọc tool sạt lở |
| `POST` | `/api/v1/landslides/refresh` | Ép cập nhật cache ngay |
| `GET` | `/api/v1/weather?commune=Tủa Chùa&days=3` | Chỉ đọc tool thời tiết |

Khi server khởi động, scheduler chạy một lần ngay lập tức, sau đó chạy theo
`LANDSLIDE_REFRESH_HOURS` (mặc định 6 giờ). Cache nằm ở
`data/landslide_dien_bien.json`. Nếu NCHMF tạm lỗi, ứng dụng dùng cache gần nhất và
đánh dấu `stale=true`, `cache_status=stale_fallback` để LLM phải cảnh báo người đọc.

## Chạy kiểm thử

```powershell
python -m unittest discover -s tests -v
```

## Quy tắc cảnh báo của nguyên mẫu

Tool thời tiết gắn tín hiệu sơ bộ cho mưa lớn, rét/sương giá, sương mù và gió mạnh.
Màu giao diện dùng 4 mức: xanh (bình thường), vàng (chú ý), cam (nguy hiểm), đỏ
(rất nguy hiểm). Đây là quy tắc sàng lọc để LLM trình bày thống nhất, **không phải
ngưỡng cảnh báo chính thức**.

## Lưu ý vận hành

- Website NCHMF là nguồn chính thức hiển thị trên bản đồ, nhưng endpoint JSON đang
  dùng không được công bố như một API ổn định. Nếu phía nguồn đổi giao diện hoặc
  endpoint, cần cập nhật `SOURCE_ENDPOINT` và parser.
- Dữ liệu thời tiết Open-Meteo là dự báo mô hình tại một điểm lưới. Địa hình núi
  có thể khiến thời tiết trong cùng xã khác nhau đáng kể; nên truyền tọa độ bản cụ
  thể khi có thể.
- “Không có bản ghi cảnh báo” không đồng nghĩa “an toàn tuyệt đối”. Bản tin khẩn
  cấp vẫn phải đối chiếu cơ quan khí tượng, chính quyền và quan sát tại chỗ.
- Trước khi triển khai công khai, nên thêm xác thực cho endpoint refresh, rate
  limiting, log giám sát, kiểm thử tải và quy trình duyệt bản tin của cán bộ.

## Nguồn dữ liệu

- NCHMF: <https://luquetsatlo.nchmf.gov.vn/>
- Open-Meteo Forecast API: <https://open-meteo.com/en/docs>
- Open-Meteo Geocoding API: <https://open-meteo.com/en/docs/geocoding-api>
- OpenStreetMap Nominatim: <https://nominatim.org/release-docs/latest/api/Search/>
- OpenAI function calling: <https://developers.openai.com/api/docs/guides/function-calling>
