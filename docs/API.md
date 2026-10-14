# API Documentation

Base URL: `/api/v1` · Auth: `Authorization: Bearer <accessToken>` · Content type: JSON

## Response envelope
```json
{ "success": true, "message": "Appointment created successfully", "data": {}, "meta": {} }
```
Errors:
```json
{ "success": false, "message": "Validation failed", "errors": [{ "field": "date", "message": "…" }], "code": "TOKEN_EXPIRED" }
```
(`errors` and `code` appear only when relevant. Stack traces and internals are never returned.)

## Status codes
`200` OK · `201` created · `400` malformed request / business rule (past slot, break) · `401` not authenticated (`code: TOKEN_EXPIRED` for an expired access token) · `403` role not allowed · `404` not found (also used to hide records a doctor may not see) · `409` conflict (slot already booked, invalid status change, duplicate) · `422` validation failed · `429` too many login attempts · `500` unexpected error.

## Roles
`SUPER_ADMIN` (SA), `RECEPTIONIST` (RC), `DOCTOR` (DR)

## Authentication
| Method & path | Roles | Description |
|---|---|---|
| `POST /auth/login` | public (rate limited) | Body `{email, password}`. Returns `{user, accessToken}`; sets the httpOnly `refreshToken` cookie (path `/api/v1/auth`). |
| `POST /auth/refresh` | public | Uses the cookie (or body `{refreshToken}`). **Rotates** the refresh token and returns a new access token. Reusing an old refresh token revokes all of that user's sessions. |
| `POST /auth/logout` | public | Revokes the refresh token server side and clears the cookie. Idempotent. |
| `GET /auth/me` | any | Current user claims. |

## Departments, staff, doctors
| Method & path | Roles | Description |
|---|---|---|
| `GET /departments` | any | List active departments. |
| `POST /departments` | SA | `{name}` |
| `POST /users/receptionists` | SA | `{name, email, password}` |
| `GET /doctors?departmentId&search&page&limit` | any (a doctor only sees themself) | Paginated doctors with user + department. |
| `GET /doctors/:id` | any | One doctor with schedule. |
| `POST /doctors` | SA | `{name, email, password, departmentId, specialization?, slotDurationMinutes, weeklySchedule[]}` |
| `PUT /doctors/:id/schedule` | SA | `{slotDurationMinutes, weeklySchedule[]}` |

`weeklySchedule` item: `{ dayOfWeek: 0-6 (0=Sunday), sessions: [{name,startTime,endTime}], breaks: [{name,startTime,endTime}] }` (times `HH:mm`). Sessions may not overlap; each block must end after it starts.

## Slots
`GET /slots?date=YYYY-MM-DD&doctorId=…` **or** `&departmentId=…` (SA, RC)

```jsonc
{ "data": { "date": "2026-10-20", "doctors": [ {
    "doctorId": "…", "doctorName": "Dr. Anil Sharma", "slotDurationMinutes": 15, "isWorkingDay": true,
    "slots": [ { "startTime": "09:00", "endTime": "09:15", "status": "AVAILABLE" },
               { "startTime": "09:15", "endTime": "09:30", "status": "BOOKED", "appointmentId": "…", "patientName": "…" } ] } ] },
  "meta": { "total": 28, "available": 25, "booked": 3 } }
```
Slot `status`: `AVAILABLE`, `BOOKED`, `PAST`. No slot is ever returned inside a break.

## Patients
| Method & path | Roles | Description |
|---|---|---|
| `GET /patients?q=` | SA, RC | Search by patient id (`P-000042`), mobile prefix (digits) or name prefix. Min 2 chars, max 20 results. |
| `GET /patients/:id` | SA, RC, DR (doctor only for own patients) | Patient details. |

## Appointments
| Method & path | Roles | Description |
|---|---|---|
| `POST /appointments` | SA, RC | Book. Body below. `409` if the slot was just taken. |
| `GET /appointments` | SA, RC, DR (own only) | Paginated list; see query below. Consultation notes are omitted for receptionists. |
| `GET /appointments/stats?date=` | SA, RC, DR (own only) | `{date, total, byStatus}` for the dashboard (one aggregation). |
| `GET /appointments/:id` | SA, RC, DR (own only) | One appointment. |
| `PUT /appointments/:id` | SA, RC: `purpose`, `notes` (while Scheduled/Arrived). DR: `consultationNotes` (while Arrived/Completed) | Partial update; at least one field. |
| `DELETE /appointments/:id` | SA, RC | Cancel (soft). Optional body `{reason}`. Frees the slot. |
| `POST /appointments/:id/arrive` | SA, RC | Scheduled → Arrived (only on the appointment date). |
| `POST /appointments/:id/complete` | SA, DR (own) | Arrived → Completed. |

Create body (exactly one of `patientId` / `newPatient`):
```json
{ "doctorId": "…", "date": "2026-10-20", "startTime": "09:15", "purpose": "Fever", "notes": "optional",
  "patientId": "…",
  "newPatient": { "name": "Asha Verma", "mobile": "9876543210", "gender": "FEMALE", "dateOfBirth": "1992-04-18", "email": "a@x.com" } }
```
Booking rules enforced on the server: doctor exists/active · date not in the past · `startTime` must be a real generated slot (working day, inside a session, not in a break) · slot time not already passed · slot still free (atomic).

List query: `page` (1), `limit` (20, max 100), `sortBy` (`date`|`createdAt`|`status`|`patientName`|`doctorName`), `sortOrder` (`asc`|`desc`), `patient` (name prefix or `P-…` id), `mobile` (digit prefix), `doctorName` (prefix), `doctorId`, `departmentId`, `status`, `dateFrom`, `dateTo`. Response `meta`: `{page, limit, total, totalPages, hasNext, hasPrev}`.

Status workflow: `SCHEDULED → ARRIVED → COMPLETED`; `SCHEDULED/ARRIVED → CANCELLED`. Any other change returns `409`.

## Audit log
`GET /audit-logs?page&limit&action&entity&userId&dateFrom&dateTo` (SA). Entries: `{user, role, action, entity, entityId, metadata, ip, createdAt}`.
Recorded actions: `LOGIN`, `LOGIN_FAILED`, `LOGOUT`, `DOCTOR_CREATED`, `RECEPTIONIST_CREATED`, `SCHEDULE_UPDATED`, `PATIENT_CREATED`, `APPOINTMENT_CREATED`, `APPOINTMENT_UPDATED`, `APPOINTMENT_CANCELLED`, `APPOINTMENT_ARRIVED`, `APPOINTMENT_COMPLETED`.

## Real-time events (Socket.IO)
Connect with `io(url, { auth: { token: <accessToken> } })`. Staff join room `staff`; a doctor joins only `doctor:<id>`.
Events: `appointment:created`, `appointment:updated` (update, arrived, completed), `appointment:cancelled`.
Payload (no patient data): `{ action, appointmentId, doctorId, departmentId, date, startTime, endTime, status, updatedAt }`.
