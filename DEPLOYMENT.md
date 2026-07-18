# Deploy checkpoint on Vercel

The repository is a monorepo. Create **two Vercel projects** from the same
GitHub repository so the submission URL includes a public API.

## 1. Backend project

Import the repository in Vercel and choose Root Directory `be`. Vercel detects
`server.py` as a FastAPI entrypoint. Add Production environment variables:

```dotenv
APP_ENV=production
LOG_LEVEL=INFO
MONGO_URI=<Atlas URI>
MONGO_DB_NAME=tramban
JWT_SECRET_KEY=<same strong secret used by the API>
CORS_ORIGINS=https://temporary.invalid
COOKIE_SECURE=true
ALLOW_OFFICIAL_SELF_REGISTRATION=false
SCHEDULER_ENABLED=false
WARMUP_ENABLED=false
SMS_ENABLED=false
CACHE_DIR=/tmp/tramban
```

Also add `LLM_API_KEY` only if an AI bulletin is required for the checkpoint.
Do not add `BOOTSTRAP_ADMIN_PASSWORD` after the admin already exists in Atlas.
Deploy and copy the backend URL, for example
`https://tram-ban-api.vercel.app`. Verify `/health` returns `mongodb: true`.

## 2. Frontend project

Import the same repository again and choose Root Directory `fe`. Add these
Production environment variables using the backend URL from step 1:

```dotenv
NEXT_PUBLIC_API_BASE=/backend
API_SERVER_BASE=https://tram-ban-api.vercel.app
API_PROXY_TARGET=https://tram-ban-api.vercel.app
```

Deploy. The rewrite makes browser auth requests same-origin, while Server
Components use `API_SERVER_BASE` directly. Verify these URLs:

- `/`
- `/ho-so`
- `/quan-ly`
- `/admin`

After the frontend URL is known, it may replace the backend `CORS_ORIGINS`
placeholder, although browser requests normally use the same-origin proxy.

## 3. Atlas Network Access

Vercel functions do not have one fixed outbound IP on the default setup. For a
short-lived competition demo, Atlas may need `0.0.0.0/0`; use a strong database
password and a user restricted to `readWrite` on database `tramban`. After the
checkpoint, replace this with private networking or a provider setup with fixed
egress and remove broad access.

## Operational limitation

APScheduler is deliberately disabled on Vercel serverless because more than one
function instance could execute the same schedule. Auth, MongoDB, admin CRUD and
on-demand weather APIs continue to work. Move schedules to Vercel Cron or a
single long-running worker after the checkpoint.
