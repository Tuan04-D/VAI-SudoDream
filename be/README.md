# Backend setup

## MongoDB Atlas

Create a dedicated Atlas database user with `readWrite` access only to the
`tramban` database. In Atlas Network Access, allow the development machine's
current public IP. Do not use an Atlas owner account in the application and do
not leave `0.0.0.0/0` enabled for production.

Copy `.env.example` to `.env`, then set these values locally (never paste the
URI, password, JWT secret or SMS delivery key into chat or source control):

```dotenv
MONGO_URI=mongodb+srv://<app-user>:<url-encoded-password>@<cluster>/?retryWrites=true&w=majority&appName=TramBan
MONGO_DB_NAME=tramban
JWT_SECRET_KEY=<at-least-32-random-characters>
COOKIE_SECURE=false
ALLOW_OFFICIAL_SELF_REGISTRATION=false

BOOTSTRAP_ADMIN_PHONE=09xxxxxxxx
BOOTSTRAP_ADMIN_PASSWORD=<at-least-8-characters-with-letters-and-digits>
BOOTSTRAP_ADMIN_DISPLAY_NAME=Quản trị hệ thống
```

Generate a suitable JWT secret with:

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
```

After the first successful startup creates the administrator, remove
`BOOTSTRAP_ADMIN_PASSWORD` from `.env`. For production HTTPS, set
`COOKIE_SECURE=true` and configure an exact HTTPS `CORS_ORIGINS` value.

## SMS bridge

The backend automatically queues an SMS for every active resident in the
alert's commune. Start with sending disabled:

```dotenv
SMS_ENABLED=false
SMS_SERVICE_URL=http://127.0.0.1:8001/api/v1/delivery/sms
SMS_DELIVERY_API_KEY=<same-random-value-as-ai-DELIVERY_API_KEY>
```

After the AI/SMS service health check is ready and a manual gateway test works,
set `SMS_ENABLED=true`. The browser never calls the SMS service directly.

## Run

```powershell
cd be
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python server.py
```

Startup pings MongoDB, creates indexes, synchronizes communes and optionally
creates the first admin. `GET /health` reports the MongoDB connection state;
API and RBAC endpoints are documented at `http://localhost:8000/docs`.
