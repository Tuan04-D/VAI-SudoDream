# Trạm Bản

Hệ thống cảnh báo thiên tai theo xã gồm ba runtime độc lập:

- `be/`: FastAPI modular monolith, MongoDB Atlas, JWT/RBAC, weather, alerts.
- `fe/`: Next.js App Router cho người dân, cán bộ và quản trị viên.
- `ai/`: service AI/video/SMS tùy chọn; không bắt buộc để web và weather chạy.

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
