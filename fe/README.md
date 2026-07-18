# Trạm Bản — Hệ thống cảnh báo thiên tai đa ngôn ngữ cho Điện Biên

Ứng dụng cảnh báo thời tiết nguy hiểm theo từng xã ở Điện Biên (sạt lở, lũ quét, mưa lớn, sương giá, dông, gió mạnh...), cho hai nhóm người dùng:

- **Người dân** — giao diện tối giản, trực quan hóa nguy cơ bằng icon/màu/hành động cụ thể (không bắt đọc số liệu kỹ thuật), âm thanh cảnh báo phân biệt theo loại thiên tai, trợ lý hỏi-đáp bằng giọng nói hoặc văn bản, tiếng Việt hoặc tiếng H'Mông.
- **Cán bộ xã** — bản đồ rủi ro toàn tỉnh, bản tin AI, theo dõi người dân đã xem cảnh báo hay chưa, tự phát cảnh báo thủ công khi cần.

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
- `infrastructure/mongo.py` — MongoDB Atlas: người dùng/RBAC, refresh session, lịch sử chat, cảnh báo, lượt xem, SMS outbox và audit log. Mật khẩu băm Argon2; refresh token chỉ lưu dạng SHA-256.
- `geo_utils.py` — sinh toạ độ mô phỏng cho người dân khi đăng ký (điểm ngẫu nhiên nằm đúng trong ranh giới xã thật, thay cho GPS thật).
- `chat/` — chatbot/voice hỏi đáp (ASR → LLM → TTS), grounded theo đúng dữ liệu xã đang xem, giới hạn phạm vi hỏi đáp thời tiết/mùa vụ/phòng tránh thiên tai, không khẳng định chắc chắn thiên tai sẽ xảy ra, không tự bịa điểm sơ tán.
- `llm_notify.py` — dịch bản tin tiếng Việt sang tiếng H'Mông dạng đọc được cho TTS (số viết thành chữ, không dùng markdown).
- Chính sách phát cảnh báo: mức **3 (Rất nguy hiểm) tự động phát**; mức 0–2 chỉ báo cho cán bộ xã xem, cán bộ tự quyết định có phát thủ công hay không. Có chống gửi trùng cảnh báo giống hệt trong ngày, tự gửi lại khi mức độ tăng.

**Frontend (`fe/`, Next.js App Router)** có 3 route chính:

- `/` — trang người dân. Mặc định hiển thị xã đã đăng ký (hoặc xã mặc định nếu chưa đăng ký), nguy cơ thể hiện bằng icon + màu + hành động cụ thể, có thể chuyển sang xem bản đồ rủi ro toàn tỉnh, âm thanh cảnh báo tổng hợp riêng theo từng loại thiên tai khi có cảnh báo mới trong lúc đang mở trang, trợ lý hỏi đáp dạng cửa sổ nổi góc phải (giọng nói/văn bản).
- `/quan-ly` — trang cán bộ xã, yêu cầu đăng nhập. Giữ đầy đủ dữ liệu chi tiết (bản đồ nhiệt độ/lượng mưa, bản tin AI, biểu đồ 5 ngày), có thêm bản đồ người dân đã xem cảnh báo (chấm xanh = đã xem, chấm đỏ = chưa xem) chọn được theo từng đợt cảnh báo, và nút tự phát cảnh báo thủ công.
- `/ho-so` — hồ sơ cá nhân, hiển thị đúng theo vai trò đang đăng nhập (người dân hoặc cán bộ).

Xác thực dùng access JWT ngắn hạn trong bộ nhớ trình duyệt và refresh token xoay vòng trong cookie HttpOnly. Backend kiểm tra vai trò, trạng thái tài khoản và phạm vi xã; tài khoản cán bộ do admin cấp, không tự đăng ký.

## 3. Chức năng hiện có

**Người dân**
- Xem dự báo + mức nguy hiểm theo xã, mặc định xã đã đăng ký.
- Trực quan hóa nguy cơ bằng icon/màu/hành động cụ thể — không bắt phải đọc số liệu.
- Nghe cảnh báo bằng âm thanh tổng hợp, phân biệt theo loại thiên tai (sạt lở, lũ quét, dông, gió, sương giá...).
- Hỏi đáp bằng giọng nói hoặc văn bản, tiếng Việt hoặc tiếng H'Mông; lưu lịch sử hội thoại nếu đã đăng nhập, xem lại được.
- Đăng ký/đăng nhập bằng số điện thoại + mật khẩu (không bắt buộc để xem thông tin cơ bản).
- Xem bản đồ rủi ro toàn tỉnh.

**Cán bộ xã**
- Đăng nhập theo xã mình quản lý.
- Xem bản đồ nhiệt độ/lượng mưa chi tiết, bản tin AI, biểu đồ dự báo 5 ngày.
- Xem bản đồ người dân đã xem cảnh báo theo từng đợt cảnh báo đã phát.
- Tự phát cảnh báo thủ công cho xã mình, kể cả khi mức rủi ro chưa đạt ngưỡng tự động.
- Xem/nghe danh sách thông báo đã phát (tự động và thủ công).

## 4. Cơ sở dữ liệu

MongoDB có các collection `communes`, `users`, `auth_sessions`, `chat_messages`,
`alerts`, `alert_views`, `alert_deliveries` và `audit_logs`. Index được tạo tự
động lúc backend khởi động. Schema, quan hệ logic, RBAC và luồng SMS outbox được
mô tả chi tiết trong `be/MONGO_SCHEMA.md`.

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

Mở `.env`, điền `LLM_API_KEY`, `MONGO_URI`, `JWT_SECRET_KEY` và tài khoản bootstrap admin. Hướng dẫn Atlas và SMS nằm trong `be/README.md`. `KAGGLE_NGROK_URL` có thể để trống nếu chưa dùng giọng nói.

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
- **Mô phỏng**: toạ độ GPS của người dân (random nhưng nằm đúng trong ranh giới xã đã chọn, thay cho GPS thiết bị thật).

## 9. Giới hạn đã biết

- Chưa có OTP và rate limiting phân tán; khi public Internet nên đặt rate limit ở API gateway/reverse proxy và bổ sung quy trình khôi phục tài khoản.
- Bản đồ chỉ có 2 mức phóng: xã và toàn tỉnh — chưa có ranh giới cấp thôn/bản (không có nguồn public đủ chi tiết).
- TTS tiếng H'Mông chạy qua Kaggle Notebook, không phải service luôn sẵn sàng — có thể lỗi ngẫu nhiên; hệ thống tự hiện "đang chuẩn bị" thay vì crash khi việc này xảy ra.
- SMS đã có durable outbox và Android/Twilio bridge; Zalo chưa tích hợp.
- Video nền trang chủ (`fe/public/misty-mountains.mp4`) là asset demo — cân nhắc Git LFS nếu muốn giữ dung lượng repo nhỏ.
