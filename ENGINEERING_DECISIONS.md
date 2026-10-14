# Engineering Decisions

## 1. Why did you choose this project architecture?
**A layered monolith**: `routes → middlewares → controllers → services → models`.

- **Controllers are thin, services own the rules.** A controller only reads validated input, calls one service and shapes the response. Booking rules (is it a real slot? is it in the past? is the slot free?) live in `appointment.service.js`, so they can be reused (e.g. by a future CLI, queue worker or another API version) and tested without HTTP.
- **Validation is separate and strict.** Zod schemas in `validators/` run before any controller. Unknown fields are rejected, types are coerced, NoSQL operator objects (`{"$ne": null}`) fail validation. Controllers read only `req.validated`.
- **Pure functions for core logic.** Slot generation has no database or clock dependency, so it is covered by fast unit tests (breaks, overlaps, durations that do not divide a session).
- **One error path.** Services throw `ApiError`; one central handler maps Zod, Mongoose, JWT and duplicate-key errors to a single JSON shape and hides internals on 5xx.
- **Why a monolith, not microservices?** The domain is small and transactional (booking needs strong consistency). A modular monolith gives the same separation of concerns without network failure modes or distributed transactions. The service layer makes a later split straightforward.
- **Frontend:** React Query for server state (caching, request de-duplication, background refetch), Context only for auth/toasts, route-level code splitting, reusable components (`Calendar`, `SlotGrid`, `Modal`, `Pagination`, `ScheduleEditor`, `FormField`). I chose React Query over Redux because almost all state here is server state; Redux would mean hand-writing caching, loading and error handling.

## 2. How did you design the MongoDB schema?
Full detail in `docs/DATABASE.md`. Key choices:

- **Store schedule rules, not slots.** `doctors.weeklySchedule` holds sessions and breaks; slots are generated on demand. A schedule change is immediately correct, and we avoid millions of empty slot documents.
- **Date and time as `YYYY-MM-DD` / `HH:mm` strings** in the clinic timezone. A clinic schedule is a wall-clock concept; storing UTC instants would create daylight-saving and "wrong day" bugs. ISO strings also sort and range-query correctly.
- **Reference vs embed:** patient, doctor and department are referenced (they have their own lifecycle). Sessions/breaks are embedded (always read with the doctor).
- **Deliberate denormalisation on `appointments`** (`patientName`, `patientMobile`, `patientCode`, `doctorName`, `departmentName`). The list screen filters and sorts on these, so one indexed query replaces a three-collection `$lookup`. Trade-off: renamed people keep the old name on old appointments, which is acceptable for a historical record.
- **Cancellation is a soft state** (`status: CANCELLED`, `isActive: false`), never a delete: history and audit stay intact and the slot becomes free again.
- **Human friendly patient id** (`P-000042`) from an atomic counter (`findOneAndUpdate` + `$inc`).

## 3. How did you prevent double booking?
**The database decides, not the application.**

A **unique partial index** on `appointments`:
```
{ doctor: 1, date: 1, startTime: 1 }  unique, partialFilterExpression: { isActive: true }
```
- Two simultaneous requests for the same slot both try to insert. MongoDB serialises the index update, so exactly one insert succeeds; the other fails with `E11000`, which the service converts to **HTTP 409** ("slot just booked, choose another").
- "Check then insert" in application code would have a race window between the check and the insert; the index has none.
- When an appointment is cancelled, `isActive` becomes `false`, so the entry leaves the index and the slot can be booked again, while the cancelled record is preserved.
- It works on a standalone MongoDB, with no transaction or replica set required.
- Related safeguards: the server re-derives the slot from the doctor's schedule (the client's time is never trusted), status changes are single atomic `findOneAndUpdate`s with the expected status in the filter (a cancel racing an "arrive" cannot both win), and `Model.init()` runs before the server starts so the index is guaranteed to exist.
- Proof: `npm run check:concurrency` fires 15 parallel bookings for one slot and expects one 201 and fourteen 409s. A test also asserts the index definition.

## 4. Which database indexes did you create and why?
See the table in `docs/DATABASE.md`. Summary:

| Index | Reason |
|---|---|
| `appointments {doctor,date,startTime}` unique partial | Double-booking guard; also the access path for the slot grid and doctor-scoped lists |
| `appointments {date,startTime}` | Date range + default sort, today's queue, dashboard stats |
| `appointments {department,date}`, `{status,date}` | Department and status filters combined with date range |
| `appointments {patientMobile}`, `{patientNameLower}`, `{doctorNameLower}` | Prefix searches without scanning |
| `patients {patientId}` unique, `{mobile}`, `{searchName}` | Booking-time patient search |
| `users {email}` unique | Login |
| `refreshtokens {jti}` unique, `{user}`, `{expiresAt}` TTL | Rotation, revoke-all, automatic cleanup |
| `auditlogs {createdAt}`, `{user,createdAt}`, `{entity,entityId}` | Recent activity, per-user, per-entity history |

I kept the count of `appointments` indexes to seven on purpose: every index slows writes and uses memory. Name search is prefix-only so it can use an index; "contains" would force a collection scan.

## 5. What security measures did you implement?
- **Passwords:** bcrypt (configurable cost, default 12); `passwordHash` is `select: false` and stripped from JSON; password policy enforced; login spends the same time for unknown emails and wrong passwords (no user enumeration), with one generic error message.
- **JWT access token:** short-lived (15 min), signed with its own secret, kept **in memory** in the browser (not localStorage).
- **Refresh token:** httpOnly, `SameSite`, `Secure` in production, cookie path limited to `/api/v1/auth`; **only a SHA-256 hash is stored** server side; **rotation** on every refresh; **reuse detection** revokes all sessions of that user; logout revokes server side; TTL index removes expired rows.
- **RBAC:** `authenticate` + `authorize(...roles)` on every route, plus **data-level rules in services** (a doctor can only read their own appointments, and gets 404 rather than 403 for other doctors' records so ids cannot be probed; a doctor can view a patient only if they have an appointment with them; receptionists never receive consultation notes).
- **Input validation:** Zod on params, query and body; strict objects; whitelisted sort fields; page size cap; regex input is escaped before use (no ReDoS / regex injection); operator objects rejected (NoSQL injection).
- **HTTP hardening:** Helmet, CORS limited to configured origins with credentials, request body limit 100 KB, `x-powered-by` removed, login rate limiting.
- **Errors:** consistent envelope; 5xx never leaks stack traces or messages.
- **Config:** secrets only from environment variables, validated at startup (fail fast, minimum length).
- **Sockets:** authenticated with the same JWT; room-based authorisation (doctors only hear their own events); events carry no patient data.
- **Audit log:** who did what and when, with IP; clinical content is never written to it (only field names).
- **Known gap:** access tokens are stateless, so a deactivated user keeps access until the token expires (≤15 min).

## 6. What performance optimisations did you apply (and why)?
**Backend**
- *Denormalised appointment snapshot* → list/search is one indexed query instead of `$lookup` joins. Needed because the list is the most used screen and filters on patient/doctor names.
- *Targeted indexes* (above) → every filter/sort combination in the UI has an index path.
- *`find` + `countDocuments` run in parallel*, `.lean()` (plain objects, no Mongoose hydration), field projections → lower latency and memory.
- *Single query for booked slots across all doctors* → no N+1 when a department is shown.
- *Dashboard counters via one `$group` aggregation* → accurate and cheap instead of fetching rows.
- *Stable, capped, server-side pagination and sorting* (`_id` tie-breaker, max 100 per page).
- *Atomic updates* (`findOneAndUpdate` with conditions) → one round trip instead of read-modify-write.
- *Audit writes are fire-and-forget* → never slow down or fail a booking.
- *Access tokens are stateless* → no database hit per request for authentication.

**Frontend**
- *Route-level code splitting* (`React.lazy`) → smaller first load.
- *React Query cache + de-duplication + `keepPreviousData`* → no flicker or duplicate requests when paging/filtering.
- *Debounced search inputs* → one request when the user pauses typing.
- *`React.memo` + `useCallback`/`useMemo`* on slot buttons, slot grid, table rows, calendar, pagination → a live update re-renders only the slot or row that changed.
- *Socket events invalidate queries instead of polling* (plus a 60 s refetch only on the scheduler so slots turn "past" as time passes).
- *Single-flight token refresh* → many parallel 401s cause one refresh call.

## 7. If this had to support millions of appointments, what would change?
1. **Queries and indexes:** keep every list query date-bounded (already enforced by the UI defaults and indexes); replace `skip/limit` with **cursor (keyset) pagination** on `(date, startTime, _id)`.
2. **Archiving:** move old appointments (e.g. >2 years) to a cold collection or storage tier; keep the hot collection small so its indexes stay in RAM.
3. **Sharding / scaling:** a replica set first (HA, read replicas for reporting). If a single node is outgrown, shard `appointments` on `{doctor, date}`; the unique slot index starts with that shard key, so it remains enforceable.
4. **Search:** replace prefix regex with a proper search engine (Atlas Search or Elasticsearch) for fuzzy name/mobile search across millions of patients.
5. **Caching:** cache doctor schedules and generated slot templates in Redis (invalidate on schedule change); only the "booked" overlay is dynamic.
6. **Real time at scale:** run multiple API instances behind a load balancer with the **Socket.IO Redis adapter**; broadcast to rooms per `doctor`/`date` so clients only receive what they view.
7. **Write path:** keep the unique-index booking (it scales with the shard key); move audit logging to a queue (BullMQ/Kafka) into a separate store; if the audit volume grows, partition by month.
8. **Stateless horizontal scaling & operations:** containerised API behind a load balancer, health/readiness probes, rate limiting at the gateway, centralised structured logs, metrics, tracing and alerting.
9. **Data integrity at scale:** wrap multi-collection writes (appointment + audit/outbox) in transactions on a replica set; use an outbox pattern for events/notifications.
10. **Reads for dashboards/reports:** pre-aggregate daily counters (or use read replicas / an analytics store) instead of aggregating live.
