# Trạm Bản MongoDB model

Only the FastAPI backend connects to MongoDB and the SMS service. Browser code
never receives database or gateway credentials. Application IDs are 24-character
strings, so API responses do not expose MongoDB `ObjectId` values.

## Collections and important fields

| Collection | Important fields | Purpose |
|---|---|---|
| `communes` | `_id`, unique `code`, `name`, `kind`, GeoJSON `center`, `active` | Canonical commune snapshot synchronized from the checked-in geographic data. |
| `users` | `_id`, unique normalized `phone`, `password_hash`, `display_name`, `role`, `permissions[]`, `status`, `commune_id`, GeoJSON `location`, `token_version`, timestamps | One identity collection for residents, officials and administrators. Passwords use Argon2. Deleted users are soft-deleted. |
| `auth_sessions` | `_id`, `user_id`, unique SHA-256 `token_hash`, `user_agent`, `ip`, `expires_at` | Rotating refresh sessions. A TTL index removes expired sessions. Raw refresh tokens exist only in an HttpOnly cookie. |
| `chat_messages` | `_id`, `resident_id`, `role`, `content`, `language`, `created_at` | Authenticated resident text-chat history. |
| `alerts` | `_id`, unique `dedup_key`, `commune_id`, risk/hazard fields, bulletin fields, `status`, `sent_by`, `delivery_outbox_status`, timestamps | Durable web alert created by the scheduler or an authorized official. |
| `alert_views` | `_id`, `resident_id`, `alert_id`, `viewed_at` | Unique resident/alert acknowledgement used by the official view map. |
| `alert_deliveries` | `_id`, `alert_id`, `recipient_id`, snapshot `recipient_phone`, `channel`, `message`, internal `status`, `attempt_count`, `next_attempt_at`, `provider_status`, `provider_message_id`, timestamps | Durable SMS outbox. Delivery status is operational data and is not shown in the resident UI. |
| `audit_logs` | `_id`, `actor_id`, `actor_role`, `action`, `entity_type`, `entity_id`, safe `metadata`, `ip`, `created_at` | Append-only record of authentication and privileged changes. Secrets and provider bodies are not logged. |

## Logical relations

MongoDB does not enforce foreign keys, so the API validates every referenced
commune/user/alert and applies role + commune scope before a write.

| From | Field | To |
|---|---|---|
| `users` | `commune_id` | `communes.code` |
| `auth_sessions` | `user_id` | `users._id` |
| `chat_messages` | `resident_id` | `users._id` (`role=resident`) |
| `alerts` | `commune_id` | `communes.code` |
| `alerts` | `sent_by` | `users._id` (`official`/`admin`), or `null` for scheduler |
| `alert_views` | `resident_id`, `alert_id` | `users._id`, `alerts._id` |
| `alert_deliveries` | `recipient_id`, `alert_id` | `users._id`, `alerts._id` |

## RBAC

| Capability | resident | official | admin | system scheduler |
|---|---:|---:|---:|---:|
| Read public forecasts/alerts | yes | yes | yes | yes |
| Update own profile | yes | yes | yes | no |
| Mark own commune alert viewed | yes | no | no | no |
| Read residents/view map | no | own commune | all | no |
| Create an alert | no | own commune | all | critical-rule only |
| CRUD users and grant roles | no | no | yes | no |
| Process SMS outbox | no | no | no | worker only |

Hiding a UI button is not a security boundary. JWT identity, account status,
token version, role and commune scope are checked by FastAPI dependencies.
Changing a password, role, permissions or status increments `token_version` and
revokes every refresh session for that user.

## Durable alert/SMS flow

1. Insert one `alerts` document using deterministic unique `dedup_key`.
2. Expand it into one unique `(alert_id, recipient_id, channel)` delivery for
   each active resident in that commune.
3. If the process stops between steps 1 and 2, the worker finds alerts whose
   `delivery_outbox_status` is still pending and safely replays expansion.
4. The worker atomically claims due deliveries, calls the internal SMS API, and
   stores submitted/retry/failed state with bounded exponential backoff.

Opening or refreshing the website never sends an SMS. Provider errors do not
delete the web alert and cannot create a second logical delivery.
