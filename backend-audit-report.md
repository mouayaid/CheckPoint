# Checkpoint Backend Audit Report

Audit date: 2026-07-10  
Scope: `backend` only, read-only application source audit.  
Validation status: backend solution builds with 0 errors when run outside the sandbox; no backend test projects were found.

## A. Executive Summary

Overall backend health score: 62/100.

| Area | Score | Rationale |
| --- | ---: | --- |
| Security | 58 | JWT setup is mostly sound, but rate limiting, active-user revalidation, upload hardening, QR trust, and error/message leakage need work. |
| Business logic | 61 | Leave and seat rules are comparatively strong; room reservation rules conflict with stated office behavior and manager/admin expectations. |
| Data integrity | 66 | Important unique indexes exist for users, seats, and poll votes; general request review, room overlaps, and concurrency tokens remain weak. |
| Production readiness | 52 | Startup config validation improved, but health checks, HSTS, forwarded headers, durable queues, request limits, and operational dependency checks are missing. |
| Maintainability | 65 | Layering is understandable; duplicated room APIs/rules, legacy Node files, and mixed error handling reduce confidence. |
| Test coverage | 15 | No backend test project was found. Critical workflows are unprotected by automated tests. |

Recommendation: conditionally ready for PFE demonstration after Phase 0 fixes; not ready for production deployment.

## B. Build and Validation Results

Commands run:

```powershell
dotnet build backend\PFE.sln -v:minimal
Get-ChildItem -Path backend -Recurse -Filter '*Test*.csproj'
rg --files backend | rg -i "(test|tests)\.(csproj|cs)$|tests?/"
git status --short
```

Results:

- Sandboxed `dotnet build backend\PFE.sln -v:minimal` exited `1` with `0` warnings and `0` errors, consistent with a sandbox/tooling failure.
- Escalated build succeeded: `PFE.Domain`, `PFE.Application`, `PFE.Infrastructure`, and `PFE.API` built.
- Build warnings: 2 x `NU1900` because NuGet vulnerability metadata download timed out. No compiler errors.
- Tests: no backend test project or backend test files were found.
- Modified files at audit completion: this report only was created by this audit. Existing dirty/untracked project files were already present before report generation.

## C. Architecture Map

| Layer | Responsibility | Notes |
| --- | --- | --- |
| `PFE.API` | Controllers, DI, JWT/CORS setup, middleware, SignalR hub, Expo/SignalR delivery workers | Controllers often translate service nulls into HTTP responses; some still catch generic exceptions. |
| `PFE.Application` | Business services, DTOs, mapping profile, abstractions | Most business rules live here. Notifications are generated directly inside domain services. |
| `PFE.Domain` | Entities and enums | Uses enum-backed state for requests/reservations and nullable fields for optional relationships. |
| `PFE.Infrastructure` | EF Core DbContext, migrations, repositories, JWT service | Critical constraints are configured here, but no row-version concurrency tokens exist. |
| Legacy `backend/controllers`, `routes`, `services`, `app.js` | Older Node-style backend remnants | Not part of the .NET request pipeline but creates maintenance/confusion risk. |

Request flow: HTTP request -> controller `[Authorize]` and route binding -> application service -> EF Core `IApplicationDbContext` -> database -> service DTO mapping -> controller `ApiResponse`. External calls occur in Cloudinary upload, SMTP email, Expo push HTTP, Python Faster-Whisper process execution, Ollama HTTP, and SignalR hub delivery.

Transactions found: leave approval/rejection uses `Serializable` and conditional updates; room reservation creation uses `Serializable`; many other state changes use plain `SaveChangesAsync`.

Major architecture concerns: room behavior is split between `RoomController`/`RoomService` and `RoomReservationsController`/`RoomReservationService`; notifications are triggered inline after commits but delivery is volatile in memory; controllers use inconsistent response envelopes and error handling.

## D. Endpoint and Authorization Inventory

| Controller | Method | Route | Allowed roles | Ownership rule | Main validation | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `AuthController` | POST | `/api/Auth/forgot-password` | Anonymous | Email only | DTO validation plus service throttling per email | High: no IP/global rate limit |
| `AuthController` | POST | `/api/Auth/verify-reset-otp` | Anonymous | Email + OTP | OTP format/service state | Medium |
| `AuthController` | POST | `/api/Auth/reset-password` | Anonymous | Email + OTP | Password length and OTP | High: brute-force surface |
| `AuthController` | POST | `/api/Auth/login` | Anonymous | Email/password | BCrypt and active flag | High: internal exception leakage |
| `AuthController` | POST | `/api/Auth/refresh` | Anonymous | Refresh token | Token hash lookup | Medium: invalid-user revocation not saved |
| `AuthController` | POST | `/api/Auth/register` | Anonymous | None | Duplicate email, password length | Medium |
| `AuthController` | GET | `/api/Auth/me` | Authenticated | Current JWT user id | Claim parse | Medium: disabled users can keep using access token |
| `AdminUsersController` | GET/PUT/DELETE | `/api/AdminUsers...` | Admin | Admin acts on route id | Service checks, partial duplicate checks | Medium |
| `ApprovalsController` | PUT | `/api/Approvals/leave/{id}` | Admin | Admin review | Delegates leave service | Low/Medium |
| `LeaveController` | POST/GET/PUT | `/api/Leave...` | Authenticated, review Admin only | Current user for own list/cancel; Admin for review | Date, overlap, balance | Medium: manager review unsupported |
| `GeneralRequestsController` | POST/GET/PUT | `/api/GeneralRequests...` | Authenticated; Admin for all/review | Current user for own; Admin for review | Category-specific validation | High: review race |
| `SeatReservationsController` | POST/DELETE/GET | `/api/SeatReservations...` | Authenticated; Admin allowed by service for id cancel | Current user from JWT; id cancel owner or Admin | Today-only, active seat, unique indexes | Medium: QR is fabricable |
| `SeatsController` | GET | `/api/Seats/map` | Authenticated | None | Date parameter | Low |
| `AdminSeatsController` | CRUD | `/api/AdminSeats...` | Admin | Admin | DTO/service validation | Low |
| `RoomReservationsController` | GET | `/api/RoomReservations/for-day` | Manager, Admin | None | roomId/date | Medium |
| `RoomReservationsController` | POST | `/api/RoomReservations` | Manager | Creator only | Conflict/time/active room | High: no office hours, no DB overlap constraint |
| `RoomReservationsController` | POST | `/api/RoomReservations/{id}/scan-start` | Manager | Owner only | QR room id and time window | High: role/business mismatch |
| `RoomReservationsController` | POST | `/api/RoomReservations/{id}/finish` | Manager | Owner only | InProgress status | High: admin cannot finish |
| `RoomReservationsController` | POST | `/api/RoomReservations/{id}/cancel` | Manager | Owner only | Active status | Medium |
| `RoomController` | GET/DELETE | `/api/Room...` | Authenticated; cancel Manager | Current manager for cancel | Service-specific rules | High: duplicate room API surface |
| `RoomsController`/`AdminRoomsController` | CRUD/QR | `/api/Rooms...`, `/api/AdminRooms...` | Read authenticated; manage Admin | Admin | Active room and DTO validation | Medium: duplicate management routes |
| `AnnouncementController` | GET/POST/PUT/DELETE | `/api/Announcement...` | Read authenticated; manage Admin | Admin | schedule dates, Cloudinary upload | Medium |
| `EventsController` | GET/POST/PUT/DELETE/RSVP | `/api/Events...` | Read/RSVP authenticated; manage Admin | Admin for manage, current user for RSVP | date/range/status | Medium |
| `NotificationsController` | GET/PUT/DELETE | `/api/Notifications...` | Authenticated | Current user only | page/pageSize/token validation | Medium: single device token |
| `MeetingTranscriptionsController` | POST/GET | `/api/MeetingTranscriptions/{reservationId}...` | Authenticated | Admin or reservation owner/creator | file service validation | High: sync CPU/process workload |
| `DepartmentChannelController` | feed/message/poll/vote | `/api/DepartmentChannel...` | Authenticated | Service department checks | DTO/service validation | Medium |
| `DepartmentsController` | GET/CRUD | `/api/Departments...` | `GET /api/Departments` anonymous; CRUD Admin | Admin for manage | DTO/service validation | Low/Medium |
| `ProfileController` | GET | `/api/Profile/me` | Authenticated | Current user | claim/service lookup | Low |
| `RolesController` | GET | `/api/Roles` | Authenticated | None | none | Low |
| `AdminStatisticsController` | GET/POST | `/api/AdminStatistics...` | Admin | Admin | date/chat DTO | Medium |
| `AdminLayoutController`/`AdminOfficeTablesController` | layout/table admin | `/api/AdminLayout...`, `/api/AdminOfficeTables...` | Admin | Admin | DTO/service validation | Low |

## E. Critical Findings

### [AUTH-001] Login leaks internal authentication errors

- Severity: High
- Category: Security / error handling
- Confidence: High
- Affected files: `backend/PFE.API/Controllers/AuthController.cs`; `backend/PFE.Application/Services/AuthService.cs`
- Affected lines: `AuthController.cs:75-79`, `AuthService.cs:60-72`, `AuthService.cs:86-90`
- Current behavior: `Login` catches all exceptions and returns `500` with the inner exception or exception message. Auth service throws explicit messages for empty/invalid password hash and missing/unsupported roles.
- Why it is risky: login becomes an oracle for internal data quality and role/configuration problems.
- Abuse scenario: an attacker probes known emails and observes whether an account has malformed hash or missing role instead of a generic login failure.
- Recommended correction: remove the controller catch, let global middleware sanitize, or catch and return a generic authentication failure while logging structured details server-side.
- Suggested automated test: corrupt a test user's password hash and assert login returns generic error without internal text.
- Breaking-change risk: Low.

### [AUTH-002] No global rate limiting on high-risk endpoints

- Severity: High
- Category: Security / abuse prevention
- Confidence: High
- Affected files: `backend/PFE.API/Program.cs`; `backend/PFE.API/Controllers/AuthController.cs`; `backend/PFE.API/Controllers/SeatReservationsController.cs`; `backend/PFE.API/Controllers/MeetingTranscriptionsController.cs`
- Affected lines: `Program.cs:248-292`, `AuthController.cs:21-106`, `MeetingTranscriptionsController.cs:26-38`, `SeatReservationService.cs:244-299`
- Current behavior: no ASP.NET rate limiter is registered. Forgot/reset/login endpoints, QR check-in, and transcription upload rely only on business validation.
- Why it is risky: brute-force login/OTP, QR scan spam, and expensive transcription calls can be abused.
- Abuse scenario: a script floods `/api/Auth/login` and `/api/MeetingTranscriptions/{id}/upload`, consuming CPU/Python workers and generating noisy auth traffic.
- Recommended correction: add named rate-limit policies for auth, QR, uploads, and AI endpoints; return consistent `429`.
- Suggested automated test: integration test that exceeds the auth limit and receives `429`.
- Breaking-change risk: Medium.

### [AUTH-003] Deactivated users can keep using existing access tokens

- Severity: High
- Category: Authorization / account lifecycle
- Confidence: High
- Affected files: `backend/PFE.API/Program.cs`; `backend/PFE.Application/Services/AuthService.cs`
- Affected lines: `Program.cs:255-265`, `AuthService.cs:76-84`, `AuthService.cs:211-220`
- Current behavior: JWT validation checks issuer, audience, lifetime, and signature only. Protected endpoints do not revalidate `IsActive`, `ApprovedAt`, or `RejectedAt` on each request.
- Why it is risky: after deactivation/rejection/deletion, access tokens remain usable until expiry.
- Abuse scenario: an admin deactivates a user, but the user continues to read profile, notifications, room/seat data, and upload files for up to the token lifetime.
- Recommended correction: add `OnTokenValidated` or authorization middleware that loads current user state and rejects inactive/rejected/deleted accounts.
- Suggested automated test: login, deactivate user, call a protected endpoint, expect `401` or `403`.
- Breaking-change risk: Medium.

### [AUTH-004] Refresh token revocation is not persisted on invalid user state

- Severity: Medium
- Category: Authentication / session lifecycle
- Confidence: High
- Affected file: `backend/PFE.Application/Services/AuthService.cs`
- Affected lines: `AuthService.cs:121-145`
- Current behavior: `storedToken.IsRevoked = true` is set, then the method returns `null` when the user lacks role/is inactive/is rejected, before `SaveChangesAsync`.
- Why it is risky: the attempted refresh token remains active in the database if the invalid condition is later removed.
- Abuse scenario: a user disabled temporarily keeps retrying refresh; when reactivated, the same old refresh token can still be accepted.
- Recommended correction: persist revocation before returning for invalid user states, ideally in a transaction.
- Suggested automated test: set inactive user with active refresh token, call refresh, assert token row is revoked.
- Breaking-change risk: Low.

### [API-001] Controllers leak expected operational errors as raw `500` details

- Severity: Medium
- Category: Error handling / API consistency
- Confidence: High
- Affected files: `RoomReservationsController.cs`; `ErrorHandlingMiddleware.cs`
- Affected lines: `RoomReservationsController.cs:57-64`, `RoomReservationsController.cs:101-107`, `ErrorHandlingMiddleware.cs:61-67`
- Current behavior: `GetReservationsForDay` returns `500` with `ex.Message`; `CreateReservation` catches generic exceptions and returns `400` with `ex.Message`. Development global middleware includes stack traces.
- Why it is risky: production and staging behavior can expose internal messages; expected service exceptions are inconsistently mapped.
- Abuse scenario: malformed requests reveal internal validation text or dependency failure details rather than stable API errors.
- Recommended correction: let typed exceptions flow to middleware, sanitize messages consistently, use ProblemDetails or one response envelope.
- Suggested automated test: force invalid room id and invalid date range, assert status and sanitized body.
- Breaking-change risk: Medium.

### [LEAVE-001] Manager leave-review rule is not implemented

- Severity: Medium
- Category: Business logic / authorization
- Confidence: High
- Affected files: `backend/PFE.API/Controllers/LeaveController.cs`; `backend/PFE.Application/Services/LeaveService.cs`
- Affected lines: `LeaveController.cs:48-70`, `LeaveService.cs:138-154`, `LeaveService.cs:187-188`, `LeaveService.cs:271-272`
- Current behavior: pending review, approve, and reject are Admin-only. Non-admin reviewers always receive an empty/null result.
- Why it is wrong: the stated intended rule allows managers to review leave only when authorized.
- Failure scenario: a manager with legitimate leave-review permission cannot see or process their team's pending leave.
- Recommended correction: model or reuse the real manager permission, filter by department/assignment, and enforce no self-review.
- Suggested automated test: authorized manager can review assigned employee leave; unauthorized manager receives `403`.
- Breaking-change risk: Medium.

### [LEAVE-002] Leave request creation notifies all admins with sensitive reason text

- Severity: Medium
- Category: Privacy / notifications
- Confidence: High
- Affected file: `backend/PFE.Application/Services/LeaveService.cs`
- Affected lines: `LeaveService.cs:116-128`
- Current behavior: every active admin receives a notification containing the employee name, department, date range, and full reason.
- Why it is risky: push notifications may display sensitive HR/medical/personal content on lock screens.
- Abuse scenario: a sensitive medical leave reason appears in an admin's push preview.
- Recommended correction: keep push/in-app notification text minimal and expose full details only after authorized navigation.
- Suggested automated test: create leave request and assert notification message does not contain the raw reason.
- Breaking-change risk: Low.

### [GENERAL-001] General request review is not concurrency-safe

- Severity: High
- Category: Data integrity / workflow
- Confidence: High
- Affected file: `backend/PFE.Application/Services/GeneralRequestService.cs`
- Affected lines: `GeneralRequestService.cs:361-394`, `GeneralRequestService.cs:406-412`
- Current behavior: service loads a pending request, mutates status/comment, and saves without transaction, conditional update, or row-version check.
- Why it is risky: two admins can approve/reject the same request concurrently; last writer wins and duplicate notifications can be sent.
- Failure scenario: Admin A approves while Admin B rejects; employee receives contradictory notifications and database reflects whichever save arrived last.
- Recommended correction: use a conditional update where `Status == Pending`, check affected rows, and wrap review plus notification decision in a transaction/outbox.
- Suggested automated test: run concurrent approve/reject and assert exactly one succeeds with one notification.
- Breaking-change risk: Medium.

### [GENERAL-002] Recovery slots are stored as JSON without database-level integrity

- Severity: Medium
- Category: Data integrity / queryability
- Confidence: High
- Affected files: `GeneralRequestService.cs`; `ApplicationDbContext.cs`
- Affected lines: `GeneralRequestService.cs:181-183`, `GeneralRequestService.cs:493-575`, `ApplicationDbContext.cs:730-742`
- Current behavior: recovery slot structure is validated in service and serialized into `RecoverySlotsJson`.
- Why it is risky: database cannot enforce slot shape, duration totals, or support indexed queries for recovery availability/reporting.
- Failure scenario: future admin import or service change writes malformed JSON that mapping/reporting cannot interpret.
- Recommended correction: keep JSON for PFE if scope demands, but add defensive parse handling; prefer a child table if recovery scheduling/reporting matters.
- Suggested automated test: malformed stored JSON does not crash listing/mapping.
- Breaking-change risk: Medium if normalized.

### [ROOM-001] Room reservations do not enforce office hours

- Severity: High
- Category: Business logic
- Confidence: High
- Affected file: `backend/PFE.Application/Services/RoomReservationService.cs`
- Affected lines: `RoomReservationService.cs:76-88`, `RoomReservationService.cs:250-255`
- Current behavior: creation validates end after start, same Tunisia day, and future time, but not 08:00-17:00.
- Why it is wrong: stated intended behavior requires office hours.
- Failure scenario: a manager reserves a room from 21:00 to 23:00; backend accepts it and blocks availability.
- Recommended correction: validate Tunisia-local start/end against configured office hours in creation and availability.
- Suggested automated test: 07:30 and 17:30 reservations are rejected; 08:00-17:00 is accepted.
- Breaking-change risk: Medium.

### [ROOM-002] Room reservation role rules conflict with intended manager/admin/employee behavior

- Severity: High
- Category: Authorization / business logic
- Confidence: High
- Affected files: `RoomReservationsController.cs`; `RoomReservationService.cs`
- Affected lines: `RoomReservationsController.cs:69-70`, `RoomReservationsController.cs:112-157`, `RoomReservationsController.cs:209-210`, `RoomReservationService.cs:66-68`, `RoomReservationService.cs:153-166`, `RoomReservationService.cs:191-202`, `RoomReservationService.cs:230-237`
- Current behavior: only managers can create, start, finish, or cancel room reservations; admin can view day reservations but cannot create/finish/cancel through this controller. Employees cannot start meetings through QR.
- Why it is wrong: intended behavior says employees start meetings through QR and Manager/Admin can finish in-progress meetings.
- Failure scenario: an admin sees a stuck meeting but cannot finish it; an employee participant cannot start a meeting by scanning room QR.
- Recommended correction: define the actual role matrix and enforce it consistently in controller and service.
- Suggested automated test: admin finish succeeds; employee QR-start succeeds only for an eligible reservation/participant if intended.
- Breaking-change risk: High.

### [ROOM-003] Room overlap safety relies on application logic only

- Severity: High
- Category: Data integrity / concurrency
- Confidence: Medium
- Affected files: `RoomReservationService.cs`; `ApplicationDbContext.cs`
- Affected lines: `RoomReservationService.cs:63-118`, `ApplicationDbContext.cs:536-584`
- Current behavior: creation uses `Serializable` and an overlap query, but the database has only a non-unique time-range index and a check constraint that end > start.
- Why it is risky: SQL Server has no native exclusion constraint; future code paths or isolation changes can bypass conflict safety.
- Failure scenario: legacy `RoomService` or a migration/import path creates overlapping active reservations.
- Recommended correction: centralize room reservation creation in one service; keep serializable transaction; add tests; consider persisted time-slot granularity or trigger if hard DB enforcement is required.
- Suggested automated test: two concurrent creates for overlapping times produce one success and one conflict.
- Breaking-change risk: Medium.

### [ROOM-004] Duplicate room APIs and services can diverge

- Severity: Medium
- Category: Maintainability / business consistency
- Confidence: High
- Affected files: `RoomController.cs`; `RoomReservationsController.cs`; `RoomService.cs`; `RoomReservationService.cs`
- Affected lines: `RoomController.cs:27-55`, `RoomReservationsController.cs:27-246`, `RoomReservationService.cs:34-257`
- Current behavior: room availability/cancellation/history live in a legacy `RoomController` plus newer `RoomReservationsController`.
- Why it is risky: two surfaces can apply different ownership, conflict, status, and availability rules.
- Failure scenario: frontend calls one controller for availability and another for creation, showing a slot that creation later rejects.
- Recommended correction: choose one room-reservation API/service as canonical and route all room reservation behavior through it.
- Suggested automated test: availability and creation use identical blocking status rules.
- Breaking-change risk: Medium.

### [ATT-001] Seat attendance QR payload is fabricable

- Severity: High
- Category: Security / attendance integrity
- Confidence: High
- Affected file: `backend/PFE.Application/Services/SeatReservationService.cs`
- Affected lines: `SeatReservationService.cs:244-260`, `SeatReservationService.cs:273-299`
- Current behavior: QR code value is accepted when it matches `SEAT:{seatId}`.
- Why it is risky: anyone who knows or guesses a seat id can fabricate a QR payload.
- Abuse scenario: an employee checks in remotely by sending `SEAT:12` without physically scanning the desk QR.
- Recommended correction: sign QR payloads or use rotating server-issued codes with expiry and location/room context.
- Suggested automated test: unsigned `SEAT:{id}` is rejected once secure QR is implemented.
- Breaking-change risk: Medium.

### [ATT-002] Seat checkout has no checkout timestamp or duration

- Severity: Medium
- Category: Attendance completeness
- Confidence: High
- Affected file: `backend/PFE.Application/Services/SeatReservationService.cs`
- Affected lines: `SeatReservationService.cs:294-323`, `SeatReservationService.cs:328-345`
- Current behavior: check-in stores `CheckedInAt`; checkout only changes status to `Completed`.
- Why it is incomplete: attendance duration, early departure, missing checkout duration, and daily work summaries cannot be computed accurately.
- Failure scenario: two employees both show completed attendance with no checkout time, making HR reporting impossible.
- Recommended correction: add `CheckedOutAt`/duration fields if attendance reporting is a requirement.
- Suggested automated test: checkout records server-side checkout time and rejects duplicate checkout.
- Breaking-change risk: Medium because schema changes.

### [NOTIF-001] Notification delivery queues are in-memory and non-durable

- Severity: Medium
- Category: Reliability / notifications
- Confidence: High
- Affected files: `NotificationService.cs`; `NotificationDeliveryQueue.cs`; `Program.cs`
- Affected lines: `NotificationService.cs:128-144`, `NotificationService.cs:177-201`, `NotificationDeliveryQueue.cs:7-61`, `Program.cs:171-175`
- Current behavior: database notification is persisted, then SignalR/Expo delivery is enqueued to bounded in-memory channels.
- Why it is risky: app restart after DB commit but before delivery loses push/SignalR delivery attempt.
- Failure scenario: leave approval notification exists in-app, but no push arrives because API restarts while job is queued.
- Recommended correction: for production, use a durable outbox table with retry state; for PFE, document in-app as source of truth.
- Suggested automated test: persisted notification remains retriable after simulated queue failure.
- Breaking-change risk: Medium.

### [NOTIF-002] Expo token model supports only one device per user

- Severity: Medium
- Category: Notifications / device management
- Confidence: High
- Affected files: `NotificationService.cs`; `ApplicationDbContext.cs`
- Affected lines: `NotificationService.cs:85-100`, `ApplicationDbContext.cs:285-286`
- Current behavior: user row has one `ExpoPushToken`; registering a new device overwrites the previous token.
- Why it is incomplete: users with phone + tablet or reinstall flows lose delivery on older devices; token ownership history cannot be audited.
- Failure scenario: user logs in on a second device and stops receiving pushes on the first without logout.
- Recommended correction: future phase: introduce a user-device token table with last-seen/revocation. Not required for current phase.
- Suggested automated test: two tokens for one user receive a push once multi-device support exists.
- Breaking-change risk: Medium.

### [NOTIF-003] Sensitive workflow details are included in push/in-app messages

- Severity: Medium
- Category: Privacy / notification UX
- Confidence: High
- Affected files: `LeaveService.cs`; `GeneralRequestService.cs`
- Affected lines: `LeaveService.cs:122-128`, `LeaveService.cs:236-242`, `LeaveService.cs:296-302`, `GeneralRequestService.cs:406-412`
- Current behavior: reasons, comments, titles, and request categories are embedded in notification messages.
- Why it is risky: Expo pushes can appear on lock screens; admin/manager comments may be private.
- Abuse scenario: rejection comment or HR request title appears in a public notification preview.
- Recommended correction: use concise messages and deep-link to authorized detail screens for sensitive content.
- Suggested automated test: notification bodies exclude raw reason/comment.
- Breaking-change risk: Low.

### [UPLOAD-001] Transcription upload accepts spoofable content type and runs synchronously

- Severity: High
- Category: Upload security / availability
- Confidence: High
- Affected files: `MeetingTranscriptionsController.cs`; `WhisperService.cs`
- Affected lines: `MeetingTranscriptionsController.cs:26-38`, `WhisperService.cs:55-83`, `WhisperService.cs:149-220`, `WhisperService.cs:387-404`
- Current behavior: upload validates size and extension, logs but accepts unrecognized content type, writes to disk, then runs Python synchronously for up to 5 minutes.
- Why it is risky: request threads/processes can be exhausted; extension/content type are not sufficient file validation.
- Abuse scenario: an authorized user uploads repeated large invalid files, tying up Python and ASP.NET request resources.
- Recommended correction: add endpoint rate limit, stricter MIME/magic-byte validation, background job processing, and status polling.
- Suggested automated test: invalid MIME/magic file is rejected; repeated uploads hit rate limit.
- Breaking-change risk: Medium/High if moving to async jobs.

### [UPLOAD-002] Recording upload is allowed regardless of reservation status

- Severity: Medium
- Category: Business logic / data integrity
- Confidence: High
- Affected files: `MeetingTranscriptionsController.cs`; `WhisperService.cs`
- Affected lines: `MeetingTranscriptionsController.cs:65-91`, `WhisperService.cs:59-63`
- Current behavior: access check verifies only ownership/admin for reservation id; service only checks reservation exists.
- Why it is wrong: cancelled, future, or never-started reservations can receive recordings/transcripts.
- Failure scenario: a manager uploads audio to a cancelled meeting and creates misleading transcript records.
- Recommended correction: require reservation status to be `InProgress` or `Completed`, depending on intended workflow.
- Suggested automated test: upload to cancelled/future reservation returns `400`/`409`.
- Breaking-change risk: Medium.

### [MEDIA-001] Announcement image lifecycle is incomplete

- Severity: Medium
- Category: File/media lifecycle
- Confidence: High
- Affected file: `backend/PFE.Application/Services/AnnouncementService.cs`
- Affected lines: `AnnouncementService.cs:28-46`, `AnnouncementService.cs:121-156`
- Current behavior: create uploads an image to Cloudinary. Update does not support image replacement; delete removes only the database row.
- Why it is risky: orphaned Cloudinary assets accumulate and admins cannot correct/replace images.
- Failure scenario: an admin deletes an announcement, but the uploaded media remains in Cloudinary indefinitely.
- Recommended correction: store Cloudinary public id; delete/replace assets when announcement changes or is deleted.
- Suggested automated test: delete announcement invokes Cloudinary delete for stored public id.
- Breaking-change risk: Medium.

### [EVENT-001] Event updates/deletes do not notify affected users

- Severity: Low
- Category: Business completeness / notifications
- Confidence: High
- Affected file: `backend/PFE.Application/Services/EventService.cs`
- Affected lines: `EventService.cs:119-125`, `EventService.cs:155-263`
- Current behavior: create sends notifications; update and delete do not.
- Why it may be wrong: users may RSVP or plan around stale time/location information.
- Failure scenario: an event time changes and attendees are never notified.
- Recommended correction: decide policy; if user-facing, notify attendees/all recipients on material changes/cancellation.
- Suggested automated test: update event time creates one update notification per recipient.
- Breaking-change risk: Low.

### [DB-001] No row-version concurrency tokens on mutable workflow entities

- Severity: Medium
- Category: Data integrity
- Confidence: High
- Affected files: `ApplicationDbContext.cs`; domain entities
- Affected lines: no `RowVersion`/`IsConcurrencyToken` found in `ApplicationDbContext.cs`
- Current behavior: state machines rely on ad hoc conditional updates or plain EF tracking.
- Why it is risky: workflows with multiple reviewers/admins can silently overwrite.
- Failure scenario: admin status update overwrites another admin's comment/status without conflict.
- Recommended correction: add row-version to `GeneralRequest`, `RoomReservation`, `LeaveRequest`, and key admin-managed entities where concurrent edits matter.
- Suggested automated test: stale update throws or returns conflict.
- Breaking-change risk: Medium because schema changes.

### [PROD-001] Missing operational health/readiness endpoints

- Severity: Medium
- Category: Production readiness / observability
- Confidence: High
- Affected file: `backend/PFE.API/Program.cs`
- Affected lines: `Program.cs:320-349`
- Current behavior: no `AddHealthChecks`, liveness, readiness, database, Cloudinary, SMTP, Ollama, or transcription dependency checks are registered.
- Why it is risky: deployment cannot distinguish "process is up" from "database/AI/email dependencies are broken."
- Failure scenario: API starts but SQL/SMTP/Ollama are unreachable; monitoring still treats it as healthy.
- Recommended correction: add `/health/live` and `/health/ready` with dependency-specific checks appropriate for PFE.
- Suggested automated test: readiness fails when DB is unavailable.
- Breaking-change risk: Low.

### [PROD-002] Missing HSTS, forwarded headers, and request-size/Kestrel hardening

- Severity: Medium
- Category: Production readiness / deployment security
- Confidence: High
- Affected file: `backend/PFE.API/Program.cs`
- Affected lines: `Program.cs:336-339`
- Current behavior: production uses HTTPS redirection only. No HSTS, forwarded headers, Kestrel/request-size limits, or proxy scheme handling were found.
- Why it is risky: reverse-proxy deployments can mishandle scheme/client IP; uploads and long-running requests lack centralized limits.
- Failure scenario: app behind a proxy generates wrong redirects or accepts larger-than-expected request bodies.
- Recommended correction: configure forwarded headers, HSTS, Kestrel/FormOptions limits, and proxy documentation.
- Suggested automated test: forwarded proto header is honored in production-like integration test.
- Breaking-change risk: Low/Medium.

### [CONF-001] Backend `.env` file exists in project tree

- Severity: Medium
- Category: Secrets / repository hygiene
- Confidence: High
- Affected path: `backend/.env`
- Affected lines: file presence only; secret values were not printed.
- Current behavior: a `.env` file exists under backend. It may be ignored, but its presence requires review.
- Why it is risky: environment files often contain database/JWT/SMTP/Cloudinary secrets.
- Abuse scenario: accidental commit or artifact upload exposes production credentials.
- Recommended correction: verify `.gitignore`, remove secrets from working tree if not needed, rotate any committed credentials.
- Suggested automated test: secret-scanning pre-commit/CI check.
- Breaking-change risk: Low.

### [MAINT-001] Legacy Node backend files remain beside the .NET backend

- Severity: Low
- Category: Dead code / maintainability
- Confidence: Medium
- Affected paths: `backend/controllers`, `backend/routes`, `backend/services`, `backend/app.js`
- Affected lines: `rg` found JavaScript controllers and services outside the .NET solution.
- Current behavior: legacy JS files coexist with the active ASP.NET Core solution.
- Why it is risky: future maintainers may patch the wrong implementation or expose old code in deployment artifacts.
- Failure scenario: a production package includes unused Node files with obsolete logic or dependencies.
- Recommended correction: archive/remove only after confirming frontend/deployment never uses them.
- Suggested automated test: deployment artifact validation excludes legacy backend.
- Breaking-change risk: Low.

## F. Non-Logical Business Behavior

| Actor | Action | Current outcome | Expected logical outcome | Affected file | Recommended rule |
| --- | --- | --- | --- | --- | --- |
| Manager with leave-review permission | Review leave | Blocked because only Admin can review | Allow only if real permission/assignment exists | `LeaveService.cs:138-154` | Add manager review permission model. |
| Admin | Finish stuck room meeting | Blocked by Manager-only route/service | Admin should be able to finish/admin-resolve | `RoomReservationsController.cs:156-157`, `RoomReservationService.cs:230-237` | Allow Admin with audit fields. |
| Employee | Start meeting by room QR | Blocked; only owner manager can start | If intended, employee/participant can start eligible meeting | `RoomReservationService.cs:153-166` | Define participant/owner rule. |
| Manager | Reserve outside office hours | Accepted if future and same day | Reject outside 08:00-17:00 | `RoomReservationService.cs:76-88` | Enforce office hours centrally. |
| User | Upload transcript to cancelled/future reservation | Allowed if owner/admin | Only valid reservation states should accept recording | `WhisperService.cs:59-63` | Require completed/in-progress. |
| Admin | Delete announcement with image | DB row deleted; Cloudinary asset remains | Media should be cleaned up | `AnnouncementService.cs:148-156` | Store public id and delete asset. |
| User | Checkout from desk | Status becomes Completed without checkout time | Store checkout timestamp/duration | `SeatReservationService.cs:302-323` | Add checkout audit fields. |

## G. Notification Trigger Matrix

| Event | Actor | Recipient | In-app | SignalR | Expo push | Logical? | Duplicate risk | Privacy risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Leave created | Employee | Active admins | Yes | Queued | Queued if token | Mostly | Low | High: reason included |
| Leave approved | Admin | Request owner | Yes | Queued | Queued if token | Yes | Low | Medium: comment included |
| Leave rejected | Admin | Request owner | Yes | Queued | Queued if token | Yes | Low | Medium: comment included |
| General request created | Employee | Active approved admins | Yes | Queued | Queued if token | Yes | Low | Medium |
| General request approved/rejected | Admin | Request owner | Yes | Queued | Queued if token | Yes | High under concurrent review | Medium |
| Announcement created | Admin | All active approved users except creator | Yes | Queued | Queued if token | Yes | Low | Low/Medium |
| Event created | Admin | All active approved users except creator | Yes | Queued | Queued if token | Yes | Low | Low |
| Department message/poll | Manager | Department users except sender | Yes | Queued | Queued if token | Yes if department scoped | Medium | Medium |
| Seat reservation cancelled by Admin | Admin | Reservation owner only | Yes | Queued | Queued if token | Yes | Low | Low |
| Seat reservation self-cancel | Owner | None | No | No | No | Yes | None | None |

Delivery behavior: database notification is committed first, then delivery is enqueued. If the in-memory queue is full or API restarts, in-app remains but SignalR/Expo delivery can be missed.

## H. State-Transition Tables

### Leave Requests

| From | To | Actor | Guard | Status |
| --- | --- | --- | --- | --- |
| None | Pending | Employee/Manager non-admin | date, overlap, balance | Valid |
| Pending | Approved | Admin only | serializable transaction, conditional update, balance | Valid but manager permission missing |
| Pending | Rejected | Admin only | serializable transaction, conditional update | Valid but manager permission missing |
| Pending | Cancelled | Owner | owner and pending | Valid |
| Approved | Cancelled | Owner | blocked | Invalid unless business wants balance restore |
| Rejected/Cancelled | Approved/Rejected | Reviewer | blocked by status check | Validly blocked |

### General Requests

| From | To | Actor | Guard | Status |
| --- | --- | --- | --- | --- |
| None | Pending | Authenticated user | category-specific validation | Valid |
| Pending | Approved | Admin | plain tracked update | Valid but concurrency unsafe |
| Pending | Rejected | Admin | plain tracked update | Valid but concurrency unsafe |
| Approved/Rejeted | Other | Admin | returns null | Blocked |
| Any | Cancelled | User | no endpoint found | Incomplete if cancellation is required |

### Room Reservations

| From | To | Actor | Guard | Status |
| --- | --- | --- | --- | --- |
| None | Active | Manager | future, same Tunisia day, active room, no conflict | Valid but no office hours and Admin excluded |
| Active | InProgress | Owner Manager | room id matches, within 15-min lead, before end | Valid technically; employee QR-start missing |
| InProgress | Completed | Owner Manager | InProgress | Valid technically; Admin finish missing |
| Active | Cancelled | Owner Manager | Active | Valid technically; Admin cancel missing |
| Completed/Cancelled | InProgress/Cancelled | Any | blocked | Valid |
| InProgress stale | Available ignored after 30 minutes in query | System | no persisted transition | Unguarded/implicit |

### Seat Reservations

| From | To | Actor | Guard | Status |
| --- | --- | --- | --- | --- |
| None | Active | Authenticated user | today only, active seat, unique active seat/user/date | Valid |
| Active | Cancelled | Owner | owner/current day or id | Valid, no notification |
| Active | Cancelled | Admin | route id, different owner | Valid, owner notified |
| Active | CheckedIn | Owner | QR `SEAT:{id}`, today, active reservation | Valid but QR insecure |
| CheckedIn | Completed | Owner | checked in today | Valid but no checkout timestamp |
| Cancelled/Completed | CheckedIn/Cancelled | Any | blocked | Valid |

### Transcription Jobs

No explicit status machine exists. Upload synchronously creates a `MeetingTranscription` only after successful processing. Failed processing deletes the temporary audio where possible, but there is no pending/failed/retry state.

## I. Data-Integrity Findings

- Strong: unique `Users.Email` index exists (`ApplicationDbContext.cs:252-254`).
- Strong: filtered active seat reservation unique indexes exist for seat/date and user/date (`ApplicationDbContext.cs:417-427`).
- Strong: event participant and poll vote uniqueness exist (`ApplicationDbContext.cs:868-869`, `ApplicationDbContext.cs:240-241`).
- Weak: room reservations have only a non-unique time-range index and check constraint (`ApplicationDbContext.cs:536-584`).
- Weak: no row-version concurrency tokens found.
- Weak: general request review lacks conditional update and transaction.
- Weak: recovery slots are JSON rather than normalized rows.
- Risk: cascade deletes on users to notifications/seat reservations/room reservations can remove history if hard delete is used; validate admin delete behavior before production.

## J. Security Findings

- High: login leaks internal auth exceptions.
- High: no global rate limiting.
- High: active/rejected account state is not rechecked for existing JWTs.
- High: seat attendance QR is fabricable.
- High: synchronous transcription upload can exhaust resources.
- Medium: upload content type is not strictly enforced; `application/octet-stream` and unrecognized content type are effectively accepted/logged.
- Medium: notification messages can expose sensitive HR data.
- Medium: `.env` file exists in backend tree and must be checked for committed secrets.
- Medium: development middleware returns stack traces; acceptable only if development environment is never public.

## K. Production-Readiness Findings

- Missing health/readiness endpoints.
- Missing HSTS and forwarded headers configuration.
- Missing global request-size/Kestrel/FormOptions limits.
- Missing rate limiting.
- In-memory notification and receipt queues are non-durable.
- Python/Faster-Whisper and Ollama are synchronous request-time dependencies.
- Cloudinary/SMTP production configuration is validated, which is good, but runtime health is not exposed.
- `AllowedHosts` is `*` in base settings, but production startup rejects wildcard, which is good.
- Swagger is gated to development and config flag, which is good.

## L. Performance Findings

Immediate:

- Transcription can hold request resources for up to 5 minutes per upload.
- Notification fan-out creates one DB row per recipient and then enqueues per recipient; acceptable for PFE scale but should be batched/outboxed for larger deployments.
- Several list endpoints are unpaginated: events by date is bounded; admin users/general requests/announcements may grow.
- `MarkAllAsReadAsync` loads all unread rows and updates in memory; use `ExecuteUpdateAsync` for many notifications.

Future scaling:

- SignalR groups are simple and appropriate now.
- Room availability uses indexed room/status/time fields, but hard overlap enforcement would need more than a normal index.
- Admin statistics/chatbot should be reviewed for expensive aggregation queries before larger datasets.

## M. Dead Code and Incomplete Features

- Legacy Node backend files remain outside the .NET solution. Evidence: `backend/controllers`, `backend/routes`, `backend/services`, `backend/app.js`.
- EF migrations still contain legacy `AbsenceRequests` history, including a later removal migration. This is normal migration history, not necessarily deletable.
- `RoomController` and `RoomReservationsController` overlap in responsibility.
- `AdminRoomsController` and `RoomsController` both expose admin room management.
- TODO found in `AdminChatbotService.cs` about missing first-name field.
- Console logging remains in `AdminUserService.cs` and `ProfileService.cs`; replace with structured logging.
- Announcement image update/delete lifecycle is incomplete.
- No multi-device notification token table exists; intentionally out of current scope but a known limitation.

## N. Missing Tests

| Test area | Priority | Required scenarios |
| --- | --- | --- |
| Authentication | Critical | login generic errors, refresh revocation, inactive token rejection |
| Authorization | Critical | role escalation attempts, disabled users on protected endpoints |
| Account approval | High | approve/reject duplicate states, deleted/rejected user login |
| Leave overlap/balance | Critical | half-day overlap, weekend count, insufficient balance, concurrent approval |
| Manager leave review | High | authorized vs unauthorized manager behavior |
| General request review | Critical | concurrent approve/reject, single notification |
| Recovery validation | High | overlapping slots, invalid totals, malformed stored JSON |
| Room reservation concurrency | Critical | overlapping creates, office hours, admin finish/cancel |
| Room QR/start | High | too early/late, wrong room, employee/admin rules |
| Seat double booking | Critical | same user/day, same seat/day, cancelled rebook |
| Seat cancellation notification | High | owner self-cancel no notification, admin cancel owner notified |
| Attendance QR | Critical | fabricated QR rejected after secure QR implementation |
| Notifications | High | related entity fields, no actor self-notification, queue failure behavior |
| Upload/transcription | Critical | unauthorized reservation, cancelled reservation, invalid file, timeout |
| Ollama unavailable | Medium | fallback summary/tasks and no request crash |
| DTO validation | High | malformed enums, required fields, over-posting attempts |

## O. Prioritized Remediation Plan

### Phase 0 - Must fix before any production deployment

| Order | Finding IDs | Files likely to change | Expected risk | Required tests |
| ---: | --- | --- | --- | --- |
| 1 | AUTH-001, API-001 | `AuthController.cs`, middleware/controllers | Low | login/error sanitization |
| 2 | AUTH-002 | `Program.cs`, controllers attributes/policies | Medium | `429` rate limit tests |
| 3 | AUTH-003, AUTH-004 | `Program.cs`, `AuthService.cs` | Medium | inactive token and refresh revocation |
| 4 | GENERAL-001, DB-001 | `GeneralRequestService.cs`, entities/DbContext/migration | Medium | concurrent review conflict |
| 5 | ROOM-001, ROOM-002, ROOM-003 | `RoomReservationService.cs`, controllers, tests | High | office hours, admin finish, concurrent overlap |
| 6 | ATT-001 | seat QR generation/validation services | Medium | signed/expiring QR validation |
| 7 | UPLOAD-001, UPLOAD-002 | transcription controller/service, job model if added | High | invalid file, status guard, rate limit |

### Phase 1 - Must fix before final PFE delivery

| Order | Finding IDs | Files likely to change | Expected risk | Required tests |
| ---: | --- | --- | --- | --- |
| 1 | LEAVE-001 | leave controller/service, role/permission helpers | Medium | authorized manager review |
| 2 | LEAVE-002, NOTIF-003 | leave/general services | Low | notification privacy text |
| 3 | ROOM-004 | room controllers/services/frontend API usage | Medium | canonical room flow |
| 4 | ATT-002 | seat entity/DbContext/migration/service | Medium | checkout timestamp |
| 5 | MEDIA-001 | Cloudinary service, announcement service | Medium | delete/replace media |

### Phase 2 - Recommended hardening

| Order | Finding IDs | Files likely to change | Expected risk | Required tests |
| ---: | --- | --- | --- | --- |
| 1 | NOTIF-001 | notification outbox/worker | Medium | retry after worker failure |
| 2 | PROD-001, PROD-002 | `Program.cs`, deployment docs | Low | health/readiness |
| 3 | CONF-001 | `.gitignore`, CI secret scan | Low | secret scan |
| 4 | EVENT-001 | event service/notifications | Low | event update/delete notification |

### Phase 3 - Optional future improvements

| Order | Finding IDs | Files likely to change | Expected risk | Required tests |
| ---: | --- | --- | --- | --- |
| 1 | NOTIF-002 | user-device token table, notification service | Medium | multi-device delivery |
| 2 | MAINT-001 | deployment packaging/repo cleanup | Low | artifact excludes legacy files |
| 3 | GENERAL-002 | normalized recovery slots | Medium/High | slot CRUD/reporting |
| 4 | Performance items | services/controllers | Low/Medium | pagination and bulk update tests |

## P. Final Verdict

What is working well:

- Clean .NET 8 layered structure with clear project boundaries.
- JWT issuer/audience/lifetime/signing-key validation is configured.
- Production startup rejects weak/missing critical config in several places.
- Seat reservation has filtered unique indexes and now avoids owner self-cancellation notifications.
- Leave approval uses a safer conditional update pattern.
- Notification DTOs include relationship fields and delivery is decoupled from DB persistence.

What is unsafe:

- No global rate limiting.
- Existing JWTs remain usable after account deactivation until expiry.
- Login can expose internal authentication data-quality errors.
- Seat QR attendance can be fabricated.
- Transcription upload is expensive and synchronous.

What is non-logical:

- Room reservation role behavior conflicts with expected Admin/Manager/Employee responsibilities.
- Room reservations can be outside office hours.
- Meeting recordings can be uploaded for invalid reservation states.
- Seat checkout does not record checkout time.

What is incomplete:

- No backend test suite.
- No health/readiness endpoints.
- Notification delivery is not durable.
- Announcement media cleanup/replacement is incomplete.
- Manager leave-review permission is not implemented.

Deployment verdict: do not deploy to real production until Phase 0 is complete. For PFE demo/final testing, the backend is conditionally acceptable if the demo environment is controlled and the known security/rate-limit/upload/room-rule risks are addressed or explicitly documented.

Console summary:

- Total findings: 24
- Critical: 0
- High: 8
- Medium: 14
- Low: 2
- Top five blockers:
  1. No global rate limiting on auth, QR, and transcription endpoints.
  2. Existing JWTs remain valid after account deactivation.
  3. General request review is concurrency-unsafe.
  4. Room reservation role and office-hour rules conflict with intended behavior.
  5. Seat attendance QR is fabricable.
- Report path: `backend-audit-report.md`
