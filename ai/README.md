# AI cảnh báo thời tiết và sạt lở cho Điện Biên

Nguyên mẫu này nhận tên một xã/phường ở Điện Biên, lấy dự báo thời tiết theo tọa
độ và cảnh báo sạt lở/lũ quét, sau đó để LLM viết bản tin tiếng Việt ngắn, dễ hiểu.
SMS đã có adapter Android Gateway (Twilio là fallback) và chế độ dry-run an toàn.
Phần gửi Zalo/loa công cộng và dịch tiếng Thái/Mông **chưa được triển khai**.

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
uvicorn app.api:app --host 0.0.0.0 --port 8001 --reload
```

Swagger UI: `http://localhost:8001/docs`

`0.0.0.0` chỉ dùng cho tham số `--host` để server lắng nghe mọi interface, không
phải địa chỉ mở trên trình duyệt. Khi chạy local, mở `http://127.0.0.1:8001/docs`
hoặc `http://localhost:8001/docs`.

Tạo bản tin:

```powershell
  curl.exe -X POST "http://localhost:8001/api/v1/advisories" `
  -H "Content-Type: application/json" `
  -d '{"commune":"Tủa Chùa","days":3}'
```

Các endpoint hữu ích:

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/health` | Kiểm tra server và việc cấu hình key |
| `POST` | `/api/v1/advisories` | Response gọn cho màn hình chính: cảnh báo chung, hiện tại và dự báo ngày |
| `GET` | `/api/v1/weather?commune=Tủa Chùa&days=3` | Chi tiết thời tiết, gồm timeline từng 6 giờ |
| `GET` | `/api/v1/landslides?commune=Tủa Chùa` | Chi tiết cảnh báo sạt lở/lũ quét từ NCHMF |
| `POST` | `/api/v1/advisories/debug` | Response đầy đủ gồm dữ liệu tool và trace, chỉ dùng khi phát triển/debug |
| `POST` | `/api/v1/landslides/refresh` | Ép cập nhật cache ngay |

### Contract cho frontend của `/api/v1/advisories`

Từ `schema_version=1.1`, endpoint chính chỉ trả dữ liệu cần cho giao diện. Nó
không còn trả `source_data`, `tool_trace`, `model` hay timeline 6 giờ. Những phần
này đã được chuyển sang endpoint chi tiết/debug để tránh lặp dữ liệu và làm
response quá dài.

Các nhóm trường chính:

| JSON path | Nội dung frontend có thể hiển thị |
|---|---|
| `advisory.overall_risk` | Cấp 0-3, nhãn, mã màu HEX và emoji cảnh báo |
| `advisory.location` | Xã, tỉnh, tọa độ, mức chi tiết `point/commune`, nguồn giải tọa độ |
| `advisory.validity` | Thời điểm phát hành, bắt đầu/kết thúc hiệu lực, múi giờ |
| `advisory.current_weather` | Hiện trạng, nhiệt độ/cảm nhận, ẩm, mưa, mây, tầm nhìn và gió |
| `advisory.daily_forecast` | Dự báo ngày và cảnh báo `landslide`/`flash_flood` nếu hiệu lực trùng ngày |
| `advisory.bulletin.text` | Bản tin dễ đọc do LLM tạo |
| `advisory.bulletin.sms_text` | Phiên bản rất ngắn cho SMS |
| `advisory.language_support` | Ngôn ngữ đã có và trạng thái triển khai Thái/Mông |
| `advisory.data_sources` | Nguồn, thời điểm dữ liệu, cờ nguồn cảnh báo chính thức |
| `advisory.data_quality` | Dữ liệu tốt/suy giảm, cache cũ và các giới hạn cần hiện trên UI |
| `links` | URL tương đối đến weather/landslide chi tiết và endpoint debug |

Ví dụ response chính rút gọn:

```json
{
  "schema_version": "1.1",
  "advisory": {
    "id": "7f9a1d2c3b4e5f60",
    "overall_risk": {
      "level": 3,
      "label": "Rất nguy hiểm",
      "color": "#C62828",
      "icon": "🔴"
    },
    "location": {
      "commune": "Tủa Chùa",
      "province": "Điện Biên",
      "display_name": "Tủa Chùa, Điện Biên",
      "latitude": 21.9,
      "longitude": 103.4,
      "granularity": "point",
      "resolver": "NCHMF landslide dataset"
    },
    "current_weather": {
      "time": "2026-07-18T10:00",
      "weather_code": 65,
      "condition": "Mưa to",
      "icon_key": "heavy_rain",
      "icon": "🌧️",
      "temperature_c": 22.1,
      "apparent_temperature_c": 24.0,
      "humidity_percent": 96,
      "visibility_m": 700,
      "wind_speed_kmh": 12,
      "wind_gust_kmh": 35
    },
    "daily_forecast": [
      {
        "date": "2026-07-18",
        "condition": "Mưa to",
        "icon_key": "heavy_rain",
        "icon": "🌧️",
        "temperature_min_c": 20.1,
        "temperature_max_c": 27.3,
        "rain_sum_mm": 70,
        "landslide": {
          "severity": {"level": 3, "label": "Rất nguy hiểm", "color": "#C62828", "icon": "🔴"},
          "valid_from": "2026-07-18T02:00:00+07:00",
          "valid_to": "2026-07-18T08:00:00+07:00",
          "official_warning": true
        },
        "flash_flood": null
      }
    ],
    "bulletin": {
      "language": "vi",
      "title": "Bản tin thời tiết Tủa Chùa",
      "text": "Nội dung bản tin do LLM tạo...",
      "sms_text": "🔴 Rất nguy hiểm - Tủa Chùa. Nguy cơ sạt lở đất..."
    },
    "language_support": {
      "available": ["vi"],
      "planned": ["thai", "hmong"],
      "translation_status": {"vi": "ready", "thai": "not_implemented", "hmong": "not_implemented"}
    },
    "data_quality": {"status": "good", "stale": false, "warnings": []}
  },
  "links": {
    "weather_details": "/api/v1/weather?commune=T%E1%BB%A7a+Ch%C3%B9a&days=3",
    "landslide_details": "/api/v1/landslides?commune=T%E1%BB%A7a+Ch%C3%B9a",
    "debug_full_response": "/api/v1/advisories/debug"
  }
}
```

Frontend chỉ nên gọi `/api/v1/weather` khi người dùng mở màn hình dự báo chi tiết,
và chỉ gọi `/api/v1/landslides` khi cần xem các bản ghi NCHMF. Không gọi đồng thời
cả ba endpoint cho màn hình chính vì `/api/v1/advisories` đã có đủ dữ liệu tóm
tắt. `/api/v1/advisories/debug` chạy lại agent nên chỉ dùng để kiểm tra, không gọi
sau mỗi request chính.

`landslide` và `flash_flood` lấy từ cửa sổ cảnh báo NCHMF (thường 6 giờ), không
phải do LLM suy luận. Cảnh báo chỉ được gắn vào ngày có thời gian giao với
`valid_from`–`valid_to`; ngoài cửa sổ đó giá trị là `null`. Response chính không
trả mảng `risks`, `residents` hay `village_officials`.

Swagger tại `/docs` có `CompactAdvisoryResponse` cho frontend và
`AdvisoryResponse` cho debug. Tiếng Thái và tiếng Mông hiện được trả trạng thái
`not_implemented`, không tạo bản dịch giả.

## Gửi thử SMS

Sao chép `.env.example` thành `.env`. Để kiểm tra payload, chưa cần kết nối điện
thoại và không cần bật gửi thật:

```powershell
curl.exe -X POST "http://localhost:8001/api/v1/delivery/sms" `
  -H "Content-Type: application/json" `
  -d '{"phone":"0918359253","message":"Cảnh báo mưa lớn tại Tủa Chùa.","dry_run":true}'
```

Response che số điện thoại, tự thêm tiền tố `[TRAM BAN]` và có trạng thái
`dry_run`. Endpoint `GET /api/v1/delivery/sms/health` cho biết cấu hình gửi thật đã
sẵn sàng hay chưa.

Muốn gửi thật qua Android, cài SMS Gateway for Android, bật Local Server và cấp
quyền `SEND_SMS`. Điền URL dạng `http://<ip-dien-thoai>:8080/message` cùng username
và password hiển thị trong app vào `ANDROID_SMS_GATEWAY_*`, sau đó đặt
`SMS_LIVE_SEND_ENABLED=true`. Máy chạy backend và điện thoại phải chung mạng LAN.

Request gửi thật phải có `dry_run=false` và header `X-Delivery-Key` khớp
`DELIVERY_API_KEY`. Chỉ mở cổng gateway trong LAN, không công khai username/password
hoặc port `8080` ra Internet. Twilio vẫn có thể dùng làm fallback bằng cách đặt
`SMS_PROVIDER=twilio` và cấu hình các biến `TWILIO_*`.

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
