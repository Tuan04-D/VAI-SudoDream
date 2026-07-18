# Trạm Bản — Hệ thống cảnh báo thiên tai đa ngôn ngữ cho Điện Biên

Ứng dụng cảnh báo thời tiết nguy hiểm theo từng xã ở Điện Biên (sạt lở, lũ quét, mưa lớn, sương giá, dông, gió mạnh...), cho hai nhóm người dùng:

- **Người dân** — giao diện tối giản, trực quan hóa nguy cơ bằng icon/màu/hành động cụ thể (không bắt đọc số liệu kỹ thuật), âm thanh cảnh báo phân biệt theo loại thiên tai, trợ lý hỏi-đáp bằng giọng nói hoặc văn bản, tiếng Việt hoặc tiếng H'Mông.
- **Cán bộ xã** — bản đồ rủi ro toàn tỉnh, bản tin AI, quản lý người đăng ký theo xã, tự phát cảnh báo thủ công khi cần.

## Cập nhật luồng người dân và cán bộ xã

- Người dân đăng ký nhận cảnh báo bằng **số điện thoại + xã/phường + bản, thôn hoặc địa chỉ nơi ở**, không cần tạo tài khoản hay nhớ mật khẩu. Nếu đăng ký lại cùng số điện thoại, hệ thống cập nhật nơi nhận cảnh báo mới.
- Người dân vẫn có thể xem dự báo và cảnh báo của các xã khác; nơi đăng ký chỉ quyết định địa bàn nhận cảnh báo và ghi nhận đã xem.
- Cán bộ xã có thể chọn và xem thời tiết của **mọi xã** trên màn hình tổng quan.
- Quyền phát cảnh báo và danh sách người đăng ký được giới hạn theo xã của tài khoản cán bộ. API server kiểm tra `official_id` và chỉ trả về người dân thuộc đúng `commune_id` được phân công.
- Danh sách người đăng ký nằm trong dashboard riêng tại [`/quan-ly/nguoi-dang-ky`](http://localhost:3000/quan-ly/nguoi-dang-ky), không làm dày trang tổng quan. Mở menu từ User Profile Card để vào dashboard hoặc đăng xuất.
- Mục hồ sơ cũ (`/ho-so`) đã được gỡ khỏi điều hướng và route.

## 1. Cấu trúc thư mục

```
fe/
├── be/            server chính (FastAPI, cổng 8000)
└── fe/            giao diện web (Next.js, cổng 3000) — thư mục hiện tại chứa file README này
```

> README này đặt trong `fe/fe/` nhưng mô tả cho cả hai phần `be/` (backend) và `fe/` (frontend).

## 2. Kiến trúc & luồng dữ liệu

Nguồn dữ liệu thật: **Open-Meteo** (dự báo thời tiết), **NCHMF** (cảnh báo sạt lở/lũ quét chính thức), **OpenStreetMap** (ranh giới hành chính 45 xã/phường Điện Biên sau sáp nhập 2025).

**Backend (`be/`)** là một process FastAPI duy nhất:

- `weather_ai/` — agent gọi Open-Meteo + NCHMF, dùng LLM (mặc định DeepSeek, đổi được qua `LLM_PROVIDER`) sinh bản tin cảnh báo tiếng Việt tự nhiên (định dạng markdown), có ràng buộc chống ảo giác — chỉ được dùng đúng số liệu trong dữ liệu nguồn, không tự bịa, không tự sinh icon/emoji trong nội dung.
- `forecast_service.py` — cache và chuẩn hoá dữ liệu dự báo, tính mức rủi ro 0–3 (Bình thường / Chú ý / Nguy hiểm / Rất nguy hiểm) theo ngưỡng mưa, nhiệt độ, gió, mã thời tiết, gắn đúng cảnh báo NCHMF vào đúng ngày, tách theo từng loại hình thái (sạt lở, lũ quét, mưa lớn, sương giá, gió mạnh, dông...).
- `db.py` — SQLite (`be/data/trambaen.db`, tự tạo khi chạy lần đầu, không cần migrate tay): tài khoản người dân/cán bộ xã (mật khẩu băm PBKDF2 + salt, không lưu plaintext), lịch sử chat, các đợt cảnh báo đã phát, ai đã xem cảnh báo nào.
- `geo_utils.py` — sinh toạ độ mô phỏng cho người dân khi đăng ký (điểm ngẫu nhiên nằm đúng trong ranh giới xã thật, thay cho GPS thật).
- `chat/` — chatbot/voice hỏi đáp (ASR → LLM → TTS), grounded theo đúng dữ liệu xã đang xem, giới hạn phạm vi hỏi đáp thời tiết/mùa vụ/phòng tránh thiên tai, không khẳng định chắc chắn thiên tai sẽ xảy ra, không tự bịa điểm sơ tán.
- `llm_notify.py` — dịch bản tin tiếng Việt sang tiếng H'Mông dạng đọc được cho TTS (số viết thành chữ, không dùng markdown).
- Chính sách phát cảnh báo: mức **3 (Rất nguy hiểm) tự động phát**; mức 0–2 chỉ báo cho cán bộ xã xem, cán bộ tự quyết định có phát thủ công hay không. Có chống gửi trùng cảnh báo giống hệt trong ngày, tự gửi lại khi mức độ tăng.

**Frontend (`fe/`, Next.js App Router)** có 3 route chính:

- `/` — trang người dân. Mặc định hiển thị xã đã đăng ký (hoặc xã mặc định nếu chưa đăng ký), nguy cơ thể hiện bằng icon + màu + hành động cụ thể, có thể chuyển sang xem bản đồ rủi ro toàn tỉnh, âm thanh cảnh báo tổng hợp riêng theo từng loại thiên tai khi có cảnh báo mới trong lúc đang mở trang, trợ lý hỏi đáp dạng cửa sổ nổi góc phải (giọng nói/văn bản).
- `/quan-ly` — trang cán bộ xã, yêu cầu đăng nhập. Có bộ chọn để xem dự báo mọi xã; chỉ xã được phân công mới có thể phát cảnh báo.
- `/quan-ly/nguoi-dang-ky` — dashboard quản lý số điện thoại và địa chỉ người dân đã đăng ký trong xã của cán bộ hiện tại.

Đăng nhập cán bộ hiện chỉ ở mức số điện thoại + mật khẩu thật (đã băm), **chưa có OTP/JWT/session/rate-limit** — đủ cho demo, cần làm thêm nếu triển khai thật. Việc giới hạn xã cho các API quản lý đã được kiểm tra phía server; không nên dùng cơ chế localStorage hiện tại cho môi trường production.

## 3. Chức năng hiện có

**Người dân**
- Xem dự báo + mức nguy hiểm theo xã, mặc định xã đã đăng ký.
- Trực quan hóa nguy cơ bằng icon/màu/hành động cụ thể — không bắt phải đọc số liệu.
- Nghe cảnh báo bằng âm thanh tổng hợp, phân biệt theo loại thiên tai (sạt lở, lũ quét, dông, gió, sương giá...).
- Hỏi đáp bằng giọng nói hoặc văn bản, tiếng Việt hoặc tiếng H'Mông; lưu lịch sử hội thoại nếu đã đăng nhập, xem lại được.
- Đăng ký nhận cảnh báo bằng số điện thoại và nơi ở, không cần tạo tài khoản.
- Xem bản đồ rủi ro toàn tỉnh.

**Cán bộ xã**
- Đăng nhập theo xã mình quản lý.
- Xem dự báo của mọi xã nhưng chỉ phát cảnh báo và quản lý người đăng ký trong xã được phân công.
- Xem bản đồ nhiệt độ/lượng mưa chi tiết, bản tin AI, biểu đồ dự báo 5 ngày.
- Mở dashboard riêng để xem số điện thoại, địa chỉ và ngày đăng ký của người dân trong xã.
- Tự phát cảnh báo thủ công cho xã mình, kể cả khi mức rủi ro chưa đạt ngưỡng tự động.
- Xem/nghe danh sách thông báo đã phát (tự động và thủ công).

## 4. Cơ sở dữ liệu

SQLite, file `be/data/trambaen.db` — **tự khởi tạo** (tạo file + bảng) khi backend chạy lần đầu, không cần thao tác migrate. Các bảng chính:

| Bảng | Nội dung |
|---|---|
| `residents` | Người đăng ký cảnh báo: số điện thoại (duy nhất), địa chỉ, xã, toạ độ mô phỏng; trường mật khẩu cũ vẫn được giữ để tương thích dữ liệu demo |
| `officials` | Cán bộ xã: số điện thoại, mật khẩu đã băm, tên, xã quản lý |
| `chat_messages` | Lịch sử hội thoại văn bản (chỉ lưu khi người dân đã đăng nhập) |
| `alerts` | Mỗi lần phát cảnh báo (tự động hoặc do cán bộ phát), mức rủi ro, loại thiên tai, nội dung, trạng thái |
| `alert_views` | Người dân nào đã xem cảnh báo (alert) nào — nguồn cho bản đồ chấm xanh/đỏ |

Có sẵn `be/mock_db.json` — 3 tài khoản người dân (cùng 1 xã, toạ độ khác nhau) + 1 tài khoản cán bộ xã quản lý xã đó, để đăng nhập thử ngay không cần đăng ký lại. Mật khẩu trong file này ở dạng thô chỉ để tiện test cục bộ — **không dùng cho hệ thống thật**.

## 5. Yêu cầu môi trường

- Python 3.10 trở lên
- Node.js 20 trở lên + npm
- 1 API key LLM (mặc định DeepSeek, đăng ký tại [platform.deepseek.com](https://platform.deepseek.com)) — dùng để sinh bản tin cảnh báo và chạy chatbot
- (Tuỳ chọn, để có giọng nói tiếng H'Mông thật) 1 tài khoản Kaggle có quyền dùng GPU Notebook — nếu bỏ qua, hệ thống vẫn chạy đầy đủ, chỉ audio tiếng H'Mông sẽ hiện "đang chuẩn bị" thay vì phát được

## 6. Cài đặt

### 6.1. Backend

```powershell
cd be
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Mở `.env` vừa tạo, điền `LLM_API_KEY`. `KAGGLE_NGROK_URL` để trống nếu chưa dùng bước Kaggle — không có vẫn chạy được bình thường.

Không cần tạo database thủ công — `db.py` tự tạo file `data/trambaen.db` và toàn bộ bảng khi server khởi động lần đầu.

### 6.2. Frontend

```powershell
cd fe
npm install
copy .env.example .env.local
```

`npm install` cài các package chính của dự án: `next` 16 (App Router), `react` / `react-dom` 19, `maplibre-gl` (bản đồ), `motion` (animation), `@tabler/icons-react` (bộ icon), `react-markdown` + `remark-gfm` (render bản tin AI dạng markdown), `clsx` (gộp className). Không cần chỉnh `.env.local` nếu chạy local — mặc định đã trỏ `NEXT_PUBLIC_API_BASE=http://localhost:8000` đúng với backend ở bước trên.

## 7. Chạy (quy trình)

```powershell
# 1) Backend — terminal 1
cd be
.\.venv\Scripts\Activate.ps1
python server.py                # http://localhost:8000

# 2) Frontend — terminal 2
cd fe
npm run dev                     # http://localhost:3000
```

Mở `http://localhost:3000`.

**(Tuỳ chọn) Giọng nói H'Mông thật**: mở `be/kaggle/kaggle_server.py` trong một Kaggle Notebook có bật GPU, chạy toàn bộ cell — notebook tự cài dependency riêng (torch, sherpa-onnx, transformers...), không dùng chung virtualenv với backend. Cuối log sẽ in ra một URL dạng `https://xxxx.loca.lt`; dán URL đó vào `KAGGLE_NGROK_URL` trong `be/.env` rồi khởi động lại backend.

## 8. Dữ liệu thật vs mô phỏng

- **Thật**: dự báo thời tiết (Open-Meteo), cảnh báo sạt lở/lũ quét (NCHMF), ranh giới hành chính 45 xã/phường (OpenStreetMap).
- **Mô phỏng**: toạ độ GPS của người dân (random nhưng nằm đúng trong ranh giới xã đã chọn, thay cho GPS thiết bị thật), tài khoản mẫu trong `mock_db.json`.

## 9. Giới hạn đã biết

- Đăng nhập cán bộ vẫn là cơ chế demo: mật khẩu có băm nhưng chưa có OTP, JWT/session thật, hay rate-limit/khoá tài khoản — cần làm lại phần xác thực nếu triển khai thật.
- Bản đồ chỉ có 2 mức phóng: xã và toàn tỉnh — chưa có ranh giới cấp thôn/bản (không có nguồn public đủ chi tiết).
- TTS tiếng H'Mông chạy qua Kaggle Notebook, không phải service luôn sẵn sàng — có thể lỗi ngẫu nhiên; hệ thống tự hiện "đang chuẩn bị" thay vì crash khi việc này xảy ra.
- Chưa tích hợp Zalo/SMS thật — kênh phân phối cảnh báo hiện tại chỉ có web.
- Video nền trang chủ (`fe/public/misty-mountains.mp4`) là asset demo — cân nhắc Git LFS nếu muốn giữ dung lượng repo nhỏ.
