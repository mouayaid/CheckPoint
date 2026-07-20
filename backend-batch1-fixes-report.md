# Checkpoint Backend Remediation Batch 1 Report

Date: 2026-07-10  
Scope implemented: the six approved backend fixes only.

## Files Changed

| File | Reason |
| --- | --- |
| `backend/PFE.API/Controllers/AuthController.cs` | Added targeted rate-limit attributes for auth/recovery endpoints and sanitized login error responses. |
| `backend/PFE.API/Controllers/SeatReservationsController.cs` | Added the QR scan/check-in rate-limit policy attribute only. |
| `backend/PFE.API/Controllers/MeetingTranscriptionsController.cs` | Added the transcription upload rate-limit policy attribute only. |
| `backend/PFE.API/Program.cs` | Registered ASP.NET Core rate limiting, added JSON 429 response, added JWT account-state validation, and placed `UseRateLimiter()` after authentication and before authorization. |
| `backend/PFE.Application/Services/AuthService.cs` | Persisted refresh-token revocation before returning failure for invalid associated accounts. |
| `backend/PFE.Application/Services/GeneralRequestService.cs` | Made approve/reject/status review concurrency-safe with a transaction and conditional update. |
| `backend/PFE.Application/Mapping/MappingProfile.cs` | Replaced recovery-slot JSON parsing with a safe logged resolver. |
| `backend-batch1-fixes-report.md` | This implementation and validation report. |

## Fix 1 - Login Error Sanitization

Old behavior: `POST /api/Auth/login` caught generic exceptions and returned raw exception or inner exception messages to the client.

New behavior:

- Invalid credentials still return the existing safe invalid-login response.
- Bad login request validation now returns a generic `Invalid request.` message.
- Unexpected login failures are logged with `ILogger<AuthController>` and return the existing `ApiResponse` structure with `An unexpected error occurred.`
- Password hash, missing role, inner exception, and stack trace details are no longer returned from `AuthController.Login`.

## Fix 2 - Rate Limiting

Implemented ASP.NET Core built-in rate limiting with named policies.

| Policy | Limit | Partition key | Endpoints |
| --- | --- | --- | --- |
| `AuthenticationPolicy` | 5 requests / 1 minute | Remote IP | `POST /api/Auth/login`, `POST /api/Auth/verify-reset-otp` |
| `PasswordRecoveryPolicy` | 3 requests / 10 minutes | Remote IP | `POST /api/Auth/forgot-password`, `POST /api/Auth/reset-password` |
| `QrScanPolicy` | 15 requests / 1 minute | Authenticated user id, fallback IP | `POST /api/SeatReservations/checkin` |
| `TranscriptionUploadPolicy` | 2 requests / 10 minutes | Authenticated user id, fallback IP | `POST /api/MeetingTranscriptions/{reservationId}/upload` |

Rate-limited responses return `429 Too Many Requests` with the project `ApiResponse` JSON shape and `Retry-After` when provided by the limiter lease.

Middleware order verified:

```text
UseRouting -> UseCors -> UseAuthentication -> UseRateLimiter -> UseAuthorization -> MapHub -> MapControllers
```

## Fix 3 - JWT Account-State Validation

Added JWT `OnTokenValidated` account-state validation.

Predicate used:

- user id claim must parse as an integer;
- user must exist;
- `IsActive` must be `true`;
- `RejectedAt` must be `null`;
- role must be one of `Employee`, `Manager`, or `Admin`.

This intentionally matches the current login rules and does not add a separate `ApprovedAt` requirement. The validation uses a no-tracking query and applies to normal API requests and SignalR hub connections that authenticate through the existing `access_token` query-string handling.

## Fix 4 - Refresh-Token Revocation

In `AuthService.RefreshTokenAsync`, a found refresh token is marked revoked before account validation. If the associated account is missing/invalid, inactive, rejected, has no role, or has an unsupported role, the service now calls `SaveChangesAsync()` before returning `null`.

Valid refresh-token rotation behavior is preserved: valid tokens are revoked, a new refresh token is created, and both changes are persisted together.

## Fix 5 - GeneralRequest Concurrency

General request review now follows a safer pattern:

- Admin authorization is still required.
- The request is checked for existence.
- If it exists but is no longer `Pending`, the service throws `ConflictException`.
- A serializable transaction is opened.
- The status/comment/resolved timestamp update runs only where `Id == requestId && Status == Pending`.
- If affected rows are `0`, the service throws `ConflictException`.
- The request is reloaded after the successful transition.
- The decision notification is created only after the status update succeeds.

Conflict mapping: the existing global middleware maps `ConflictException` to `409 Conflict` with the safe message:

```text
Cette demande a dÃ©jÃ  Ã©tÃ© traitÃ©e.
```

This prevents silent overwrite and duplicate decision notifications from the second concurrent reviewer.

## Fix 6 - Recovery JSON Safety

Parsing location found:

- `MappingProfile` maps `GeneralRequest.RecoverySlotsJson` into `GeneralRequestDto.RecoverySlots`.

New behavior:

- `null`, empty, or whitespace JSON returns an empty slot list.
- Valid JSON preserves existing DTO behavior.
- Malformed stored JSON returns an empty slot list and logs a structured warning with only request id and exception type.
- Creation remains strict: `GeneralRequestService.ValidateAndNormalizeRecovery` still validates recovery request payloads before serialization.

## Tests

No backend test project exists in the solution. I did not add a new test project because the most important behaviors in this batch, especially SQL concurrency and JWT pipeline behavior, need a real ASP.NET Core/SQL Server integration setup. EF Core InMemory would be misleading for the GeneralRequest concurrency guarantee.

Command result:

```powershell
dotnet test backend\PFE.sln --no-build -m:1 -v minimal
```

Completed with exit code `0`, but no test assemblies were present to execute.

## Build Results

Commands run:

```powershell
dotnet restore backend\PFE.sln
dotnet build backend\PFE.sln --no-restore -m:1 -v minimal
dotnet test backend\PFE.sln --no-build -m:1 -v minimal
```

Results:

- `dotnet restore`: succeeded after rerunning outside the sandbox. Warning: `NU1900` vulnerability metadata download timed out.
- `dotnet build`: succeeded with `0` errors. Final build warning: `NU1900` vulnerability metadata download timed out.
- Earlier build pass also surfaced the pre-existing `CS1998` warning in `backend/PFE.Infrastructure/Repositories/UserRepository.cs`; the final no-restore build only reported `NU1900`.
- `dotnet test`: succeeded with exit code `0`; no backend tests were present.

## Manual Tests

### Login error sanitization

1. Temporarily corrupt a test user's `PasswordHash` in SQL Server.
2. Call `POST /api/Auth/login` with that user's email/password.
3. Expected: `500` with `ApiResponse` message `An unexpected error occurred.`
4. Verify server logs contain the exception; response must not contain password-hash or role details.

### Rate-limited auth endpoint

1. Send 6 login requests within 1 minute from the same IP.
2. Expected: first 5 follow normal login behavior; 6th returns `429`.
3. Response should be JSON `ApiResponse` and include `Retry-After` when available.

### JWT account-state validation

1. Login with an active approved user and save the access token.
2. In SQL Server or Admin API, set that user `IsActive = 0`.
3. Call `GET /api/Auth/me` with the old token.
4. Expected: authentication fails consistently with `401`/challenge behavior.

### Refresh revocation for inactive user

1. Login and save a refresh token.
2. Set the user `IsActive = 0`.
3. Call `POST /api/Auth/refresh`.
4. Expected: client receives safe invalid refresh response.
5. Query `RefreshTokens` for the token hash and verify `IsRevoked = 1`.

### GeneralRequest concurrency

1. Create one pending general request.
2. Use two Admin tokens.
3. Fire `PUT /api/GeneralRequests/{id}/approve` and `PUT /api/GeneralRequests/{id}/reject` at the same time.
4. Expected: exactly one request returns success; the other returns `409 Conflict`.
5. Verify final DB status has one decision only.
6. Verify exactly one decision notification titled `Request Status Updated` was created for the request owner.

### Malformed recovery JSON

1. Create a recovery general request.
2. Manually set `RecoverySlotsJson` to malformed text for that row.
3. Call `GET /api/GeneralRequests/my` as the owner and `GET /api/GeneralRequests` as Admin.
4. Expected: endpoints succeed; `RecoverySlots` is empty; logs contain the request id and exception type only.

## Remaining Risks

- No automated backend test harness exists yet.
- SQL Server concurrency behavior still needs manual/integration verification.
- Rate-limit counters are in-memory framework counters; they reset on app restart and are per API instance.
- `ApprovedAt` is not separately enforced for JWT validation because current login rules rely on `IsActive` and `RejectedAt`.

## Verification Summary

- Build status: passed with `0` errors.
- Test status: `dotnet test` passed, but no backend tests were present.
- Number of files changed: 8.
- Migration created: no.
- Frontend changes required: no.
- Behavior outside the six approved fixes changed: no intentional changes outside the approved batch.
