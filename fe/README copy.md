# Trạm Bản — Hệ thống cảnh báo thiên tai đa ngôn ngữ cho Điện Biên

Ứng dụng cảnh báo thời tiết nguy hiểm theo từng xã ở Điện Biên, có định lượng độ tin cậy, hiển thị bản đồ trực quan và một trợ lý hỏi-đáp bằng giọng nói tiếng Việt hoặc tiếng H'Mông.

Repo này gồm 3 phần chạy độc lập:

```
fe/
├── backend/                     server chính (FastAPI, cổng 8000)
│   ├── data/                    ranh giới hành chính Điện Biên (GeoJSON, dữ liệu thật từ OpenStreetMap)
│   ├── chatbot_agent_voice/     server chatbot/voice (FastAPI, cổng 8001) — module độc lập
│   │   └── kaggle_server.py     chạy trên Kaggle Notebook (GPU) — ASR/TTS tiếng Mông + Việt
│   └── ...
└── frontend/                    giao diện web (Next.js, cổng 3000)
```

## 1. Kiến trúc & thứ tự chạy

4 tiến trình, **chạy đúng thứ tự sau** (mỗi bước 1 cửa sổ terminal riêng):

1. **Kaggle model server** — `backend/chatbot_agent_voice/kaggle_server.py` chạy trên Kaggle Notebook có GPU, expose ASR/TTS tiếng Mông + ASR tiếng Việt ra ngoài qua `localtunnel`. Khi chạy xong sẽ in ra một URL dạng `https://xxxx.loca.lt`.
2. **Chatbot backend** (cổng 8001) — dán URL ở bước 1 vào biến `KAGGLE_NGROK_URL`, rồi chạy. Đây là module độc lập với server chính, chỉ lo phần chat/voice.
3. **Server chính** (cổng 8000) — sở hữu dữ liệu xã/dự báo/thông báo; chỉ gọi sang chatbot backend (bước 2) để lấy audio TTS tiếng Mông khi sinh thông báo hàng loạt.
4. **Frontend** (cổng 3000) — gọi thẳng cả 2 backend: server chính cho dữ liệu bản đồ/dự báo/thông báo, chatbot backend cho chat/voice (để độ trễ thấp, không đi vòng qua server chính).

Nếu chỉ muốn xem giao diện + dữ liệu dự báo/thông báo (không cần chat thoại tiếng Mông), có thể bỏ qua bước 1–2 — server chính và frontend vẫn chạy bình thường, chỉ phần audio tiếng Mông sẽ hiển thị "đang chuẩn bị" thay vì phát được.

## 2. Yêu cầu môi trường

- Python 3.10 trở lên
- Node.js 20 trở lên + npm
- 1 API key DeepSeek (đăng ký tại [platform.deepseek.com](https://platform.deepseek.com)) — dùng để sinh văn bản cảnh báo và chạy chatbot
- (Tuỳ chọn, để có giọng nói tiếng Mông thật) 1 tài khoản Kaggle có quyền dùng GPU Notebook

## 3. Cài đặt

### 3.1. Backend (server chính + chatbot backend dùng chung 1 virtualenv)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Sao chép file cấu hình mẫu và điền key thật vào:

```powershell
copy .env.example .env
copy chatbot_agent_voice\.env.example chatbot_agent_voice\.env
```

Mở 2 file `.env` vừa tạo, điền `DEEPSEEK_API_KEY` (giống nhau ở cả 2 file). File `chatbot_agent_voice\.env` còn có `KAGGLE_NGROK_URL` — để trống nếu chưa chạy Kaggle server, hoặc dán URL `loca.lt` vào sau khi chạy xong bước Kaggle.

`kaggle_server.py` **không** dùng virtualenv trên — nó tự cài dependency riêng (torch, sherpa-onnx, transformers...) ngay trong môi trường Kaggle Notebook khi được chạy.

### 3.2. Frontend

```powershell
cd frontend
npm install
copy .env.example .env.local
```

Giá trị mặc định trong `.env.local` (trỏ về `localhost:8000` / `localhost:8001`) đã đúng cho chạy local, không cần chỉnh gì thêm.

## 4. Chạy

```powershell
# 1) Kaggle: mở kaggle_server.py trong 1 Kaggle Notebook có bật GPU, chạy toàn bộ cell
#    copy URL loca.lt in ra cuối log, dán vào backend/chatbot_agent_voice/.env

# 2) Chatbot backend
cd backend\chatbot_agent_voice
..\.venv\Scripts\Activate.ps1
python server.py            # http://localhost:8001

# 3) Server chính (terminal khác)
cd backend
.\.venv\Scripts\Activate.ps1
python server.py            # http://localhost:8000

# 4) Frontend (terminal khác)
cd frontend
npm run dev                 # http://localhost:3000
```

Mở `http://localhost:3000`.

## 5. Dữ liệu hiện là mô phỏng (demo)

Đây là bản UI/tích hợp — pipeline machine learning downscaling thời tiết thật **chưa được huấn luyện**. Các phần sau đang dùng dữ liệu mock, được sinh có chủ đích để demo giao diện, không phải output model thật:

- **Dự báo 5 ngày** (`backend/mock_forecast.py`) — số liệu nhiệt độ/lượng mưa/mức rủi ro sinh có seed cố định theo xã + ngày, dựa trên khí hậu nền tháng 7 Điện Biên. Cần thay bằng output thật từ pipeline downscaling (XGBoost + conformal prediction) khi có model.
- **Văn bản cảnh báo** (`backend/llm_notify.py`) — gọi DeepSeek, ràng buộc chỉ được dùng đúng số liệu trong JSON rủi ro (chống ảo giác), có fallback template khi API lỗi.
- **Lưu trữ thông báo** — danh sách in-memory, mất khi restart server (chưa có database).
- **Tài khoản người dùng** — chưa có đăng nhập/đăng ký thật; mục "Hồ sơ" đang khoá tạm.

Ranh giới hành chính xã/tỉnh (`backend/data/*.geojson`) là **dữ liệu thật**, lấy trực tiếp từ OpenStreetMap.

## 6. Giới hạn đã biết

- Bản đồ chỉ có 2 mức phóng: xã và toàn tỉnh — chưa có ranh giới cấp thôn/bản (không có nguồn public đủ chi tiết).
- `deepseek-v4-flash` là reasoning model, tốn token cho suy luận ẩn trước khi trả lời — các lời gọi LLM đều set `max_tokens` cao để tránh bị cắt rỗng.
- TTS tiếng Mông trên Kaggle thỉnh thoảng lỗi ngẫu nhiên (~10-20% request) không rõ nguyên nhân từ phía model — hệ thống đã xử lý bằng cách hiện "Âm thanh đang chuẩn bị" thay vì crash khi việc này xảy ra.
- Video nền trang chủ (`frontend/public/misty-mountains.mp4`, ~2.5MB) là asset demo — cân nhắc dùng Git LFS nếu muốn giữ dung lượng nhỏ.
