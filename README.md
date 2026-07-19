# Trạm Bản

Hệ thống cảnh báo thiên tai theo xã gồm ba runtime độc lập:

- `be/`: FastAPI modular monolith, MongoDB Atlas, JWT/RBAC, weather, alerts.
- `fe/`: Next.js App Router cho người dân, cán bộ và quản trị viên.
- `ai/`: service AI/video/SMS tùy chọn; không bắt buộc để web và weather chạy.
- `research/weather_downscaling/`: pipeline train/evaluate offline; **không được
  import vào runtime** và không làm thay đổi dự báo/cảnh báo của bản demo.

## Chạy local

```powershell
# Terminal 1
cd be
.\.venv\Scripts\Activate.ps1
python server.py

# Terminal 2
cd fe
npm run dev
```

- Web: <http://localhost:3000>
- Admin: <http://localhost:3000/admin>
- API docs: <http://localhost:8000/docs>
- Health: <http://localhost:8000/health>

Không commit `.env`. Cấu hình backend theo `be/.env.example`; chi tiết Mongo và
bootstrap admin nằm trong `be/README.md`.

Xem [ARCHITECTURE.md](ARCHITECTURE.md) trước khi thêm module hoặc dependency mới.

## AI và weather research

Production hiện lấy dự báo Open-Meteo, tính độ tin cậy từ spread giữa
ECMWF/GFS/ICON và dùng rule cảnh báo có thể giải thích. Repo còn có
[pipeline downscaling offline](research/weather_downscaling/README.md) để tải
GFS Global, ghép ERA5-Land/ERA5, thêm SRTM (khi có GeoTIFF), train residual model
và xuất temporal/spatial holdout metrics. Artifact research luôn bị chặn khỏi
runtime cho đến khi qua kiểm định forecast lead-time và safety review.
