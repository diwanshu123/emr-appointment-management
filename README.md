# Enterprise EMR — Appointment Management

A production-minded Appointment Management module for an Electronic Medical Record system, built with the MERN stack (MongoDB, Express, React, Node.js) plus Socket.IO for live updates.

## Project overview
- **Roles:** Super Admin, Receptionist, Doctor (role-based access on every API and screen).
- **Doctors & schedules:** working days, multiple sessions per day, slot duration, breaks.
- **Scheduler:** filter by department, doctor and date; live slot grid (available / booked / past).
- **Booking:** existing patient (search by ID, mobile, name) or new patient (created automatically).
- **No double booking:** guaranteed by the database (unique partial index), not by application checks.
- **Appointment management:** status workflow Scheduled → Arrived → Completed / Cancelled, edit purpose and notes, cancel, server-side search / filter / sort / pagination.
- **Audit trail:** login, create, update, cancel and more.
- **Real time:** all connected users see appointment changes instantly (Socket.IO).

Related documents: [`ENGINEERING_DECISIONS.md`](ENGINEERING_DECISIONS.md) · [`docs/API.md`](docs/API.md) · [`docs/DATABASE.md`](docs/DATABASE.md)

## Folder structure
```
emr-appointments/
├── backend/
│   ├── src/
│   │   ├── config/        env validation (fail-fast), database connection
│   │   ├── models/        Mongoose schemas + indexes
│   │   ├── validators/    Zod schemas for every request
│   │   ├── middlewares/   authenticate, authorize (RBAC), validate, error handler
│   │   ├── routes/        URL → middleware → controller wiring only
│   │   ├── controllers/   thin: read validated input, call a service, send response
│   │   ├── services/      ALL business logic (booking, slots, auth, audit …)
│   │   ├── sockets/       Socket.IO setup and event emitters
│   │   ├── utils/         ApiError, response helper, slot generator, time helpers
│   │   ├── app.js         Express app (no network listen — easy to test)
│   │   └── server.js      HTTP server, Socket.IO, graceful shutdown
│   ├── scripts/           seed, create-admin, concurrency-check
│   └── tests/             unit + HTTP tests
├── frontend/
│   └── src/
│       ├── api/           axios client (token refresh) + endpoint functions
│       ├── context/       Auth, Toast
│       ├── hooks/         useRealtime, useDebounce, useAppointmentMutation
│       ├── components/    Calendar, SlotGrid, Modal, Pagination, ScheduleEditor …
│       ├── pages/         Login, Dashboard, Scheduler, Booking, Appointments, Doctors
│       └── utils/         dates, validation, schedule helpers
├── docs/                  API.md, DATABASE.md
├── docker-compose.yml     mongo + api + web (nginx)
└── ENGINEERING_DECISIONS.md
```

## Architecture overview
```
React (Vite) ──HTTP /api/v1──▶ Express ─▶ routes ─▶ middlewares ─▶ controllers ─▶ services ─▶ Mongoose ─▶ MongoDB
     ▲                              │                                   │
     └──────── Socket.IO ◀──────────┴──── emit after successful write ──┘
```
- **Layered backend:** routes → middleware (auth, RBAC, validation) → thin controllers → services (business rules) → models. Controllers never contain logic; services never touch `req`/`res`.
- **Pure core logic:** slot generation is a pure function (`utils/slotGenerator.js`) with unit tests.
- **Server state in the UI** is handled by React Query (caching, de-duplication, refetch); **auth state** by Context. Live socket events simply invalidate queries, so the UI always re-reads through the authorised REST API.
- **Tokens:** short-lived access token in memory; rotating refresh token in an httpOnly cookie.

## Database design
Collections: `users`, `doctors`, `departments`, `patients`, `appointments`, `refreshtokens`, `auditlogs`, `counters`. Full diagram, indexes, sample documents and query strategy: [`docs/DATABASE.md`](docs/DATABASE.md).

## API documentation
Full reference with roles, bodies, query parameters and status codes: [`docs/API.md`](docs/API.md). Required endpoints from the brief are all present, plus a few extras (departments, receptionist creation, patient search, complete, stats, audit logs).

## Environment variables
**Backend (`backend/.env`, see `.env.example`)**

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | development | `development` / `test` / `production` |
| `PORT` | 5000 | API port |
| `MONGO_URI` | – (required) | MongoDB connection string |
| `JWT_ACCESS_SECRET` | – (required, ≥32 chars) | Signs access tokens |
| `JWT_REFRESH_SECRET` | – (required, ≥32 chars) | Signs refresh tokens (must differ) |
| `ACCESS_TOKEN_TTL` | 15m | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | 7 | Refresh token lifetime |
| `CLIENT_ORIGIN` | http://localhost:5173 | Allowed CORS / Socket.IO origin(s), comma separated |
| `CLINIC_TIMEZONE` | Asia/Kolkata | Timezone used to decide "today" and "past" |
| `BCRYPT_ROUNDS` | 12 | bcrypt cost |
| `COOKIE_SAMESITE` | lax | `lax` / `strict` / `none` |
| `TRUST_PROXY` | 0 | Number of reverse proxies in front of the API |

**Frontend (`frontend/.env`, optional):** `VITE_API_URL`, `VITE_SOCKET_URL` — leave empty in development (Vite proxies to the API).

## Installation
Requirements: Node.js 18+, MongoDB 6+ running locally (or a connection string).

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # then set MONGO_URI and two different 32+ char JWT secrets
npm run seed                # demo data (refuses to run in production)

# 2. Frontend
cd ../frontend
npm install
```

## Running the project
```bash
# terminal 1
cd backend && npm run dev          # http://localhost:5000
# terminal 2
cd frontend && npm run dev         # http://localhost:5173
```
Demo logins (password for all: `Admin@12345`):

| Role | Email |
|---|---|
| Super Admin | `admin@emr.local` |
| Receptionist | `reception@emr.local` |
| Doctor | `anil.sharma@emr.local`, `meera.iyer@emr.local` |

**Tests:** `cd backend && npm test`
**Concurrency proof** (with the API running): `cd backend && npm run check:concurrency` → expects exactly one `201` and the rest `409`.
**First admin in production:** `ADMIN_NAME=… ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-admin`

### Docker (optional)
```bash
cp .env.example .env     # fill in the two JWT secrets
docker compose up --build            # app at http://localhost:8080
# create the first admin:
docker compose run --rm -e ADMIN_NAME="Admin" -e ADMIN_EMAIL=admin@clinic.com -e ADMIN_PASSWORD='ChangeMe123' api node scripts/create-admin.js
```
Demo data inside Docker: `docker compose run --rm -e NODE_ENV=development api node scripts/seed.js`

Hosted URL: _not deployed_

## Assumptions
- One clinic in one timezone (`CLINIC_TIMEZONE`). Dates are plain `YYYY-MM-DD` and times `HH:mm` in that timezone.
- Mobile numbers are 10-digit Indian numbers. They are **not unique** (family members can share one).
- A patient is registered through booking ("new patient"); there is no separate patient-management screen.
- Rescheduling = cancel and book again (keeps the audit trail simple and the slot logic in one place).
- A patient can only be marked **Arrived** on the day of the appointment.
- Consultation notes are clinical data: visible to the treating doctor and Super Admin, hidden from receptionists.
- Roles are fixed to the three in the brief; a user has exactly one role.
- Access tokens are stateless; deactivating a user takes effect when their access token expires (≤15 min) and they try to refresh.

## Known limitations
- **No automated integration tests against a real MongoDB** are included. Unit and HTTP-level tests cover slot logic, validation, authentication and RBAC; the concurrency script covers double booking. Adding an integration suite (for example with `mongodb-memory-server`) is the first improvement.
- Patient name / doctor name / mobile search is **prefix based** (fast and index friendly), not "contains".
- The same patient can be booked with two different doctors at the same time (only the slot is protected, not the person).
- No password reset / change-password flow, no email or SMS reminders.
- Socket events do not carry patient data; clients refetch. A very large number of simultaneous viewers each refetching could be heavy (see scaling notes).
- Pagination uses `skip`, which slows down on very deep pages.
- Frontend has no automated tests.

## Future improvements
- Integration and end-to-end tests (Vitest + React Testing Library, Playwright), CI pipeline.
- Cursor (keyset) pagination, Redis cache for slot templates, Redis adapter for Socket.IO to run several API instances.
- Patient management screen with duplicate detection; patient portal.
- Waiting-list, recurring appointments, reschedule in one step, SMS / email reminders.
- Password reset, 2FA for Super Admin, account lockout, per-user session list.
- OpenAPI/Swagger generated from the Zod schemas; structured logging with request ids; metrics and tracing.
