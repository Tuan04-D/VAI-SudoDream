# Architecture

Trạm Bản dùng **modular monolith**. Đây là lựa chọn có chủ đích: transaction,
RBAC và vận hành vẫn đơn giản như một backend, nhưng ranh giới module đủ rõ để
tách worker/service sau này nếu tải thực tế yêu cầu.

## Backend

```text
be/
├── api/routes/          HTTP validation, auth dependencies, response mapping
├── core/                environment config, password/JWT/RBAC
├── infrastructure/      MongoDB implementation and external adapters
├── services/            cross-domain workflows and schedulers
├── chat/                chat/voice domain
├── weather_ai/          weather tool domain
├── tests/               unit and API-contract tests
├── app_factory.py       middleware and router composition
└── server.py            development/process entrypoint only
```

Dependency direction:

```text
api/routes → services → infrastructure
     │          │             ↑
     └──────── core ──────────┘
```

Rules:

1. Route modules do not call providers directly; they call a service or a
   repository adapter.
2. Browser identity is never accepted from request bodies when it exists in
   the access token.
3. Mongo documents are serialized only at the infrastructure boundary.
4. Scheduled jobs are registered in `services/runtime.py`; importing a module
   must not start a job or open a network connection.
5. Secrets stay in `.env`; logs contain request IDs, never tokens/provider bodies.

## Frontend

```text
fe/
├── app/                 routes and server-component data loading
├── features/
│   ├── auth/            session API and AuthProvider
│   ├── admin/           user/RBAC administration UI
│   ├── alerts/          alert API
│   ├── forecast/        forecast API
│   └── chat/            chat API
├── components/          reusable presentation/composite UI
└── lib/
    ├── api/client.ts    HTTP transport, refresh rotation, ApiError
    └── ...              shared stateless utilities/contracts
```

Rules:

1. Feature code imports its own API module; `lib/api.ts` is only a migration
   facade for older components.
2. Access tokens live in memory. Refresh tokens remain HttpOnly cookies.
3. Server components fetch public data only. Authenticated mutations run from
   client components through the shared API client.
4. UI authorization is convenience only; FastAPI remains the security boundary.

## Scale path

- Scale FastAPI horizontally behind a reverse proxy; Mongo sessions/outbox are
  already shared, while APScheduler must run in exactly one designated worker.
- Move scheduled weather/notification jobs into a worker process before running
  multiple API replicas.
- Add Redis only when measurements justify distributed cache/rate limiting.
- Extract SMS/video into separate deployments without changing browser APIs.

## Research boundary

`research/` là vùng thử nghiệm reproducible, không nằm trong dependency graph
của `be/`, `fe/` hay `ai/`. Pipeline weather downscaling được phép tải dataset,
train model và sinh model card nhưng artifact luôn mang
`accepted_for_runtime=false`. Muốn đưa model vào backend phải có adapter riêng,
contract test, đánh giá forecast lead-time, calibration và phê duyệt nghiệp vụ;
việc chỉ đạt metric offline không tự động cho phép phát cảnh báo.
