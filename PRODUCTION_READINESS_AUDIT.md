# Checkpoint Production Readiness Audit

## Executive Summary

**Overall readiness rating:** 58 / 100

**Recommendation:** NO-GO

**Finding counts:**

- Critical: 2
- High: 8
- Medium: 10
- Low: 4

**Main deployment blockers:**

- A real SMTP credential is committed in development configuration.
- Android release builds are configured to use the debug signing key and allow cleartext traffic.
- Backend API build did not complete in this environment, returning failed build with zero compiler diagnostics.
- Production reverse-proxy hardening is incomplete: no forwarded headers or HSTS are configured.
- Meeting transcription runs CPU-heavy Whisper work inside HTTP requests on local disk, with no queue or capacity guard.
- Frontend dependency audit reports high vulnerabilities and `expo-doctor` reports Expo/native config issues.

## Findings

### PRD-001 - Committed SMTP credential in development configuration

**Severity:** Critical  
**Production blocker:** Yes  
**Complexity:** Small  
**Affected files:** `backend/PFE.API/appsettings.Development.json`  
**Affected workflows:** password reset email, local/development backend config

**Evidence**

`appsettings.Development.json` contains non-empty `Email:Username`, `Email:Password`, and `Email:From` values. The value itself is not repeated here.

**Impact**

Anyone with repository access can use or leak the SMTP account. If this credential has ever been pushed remotely, it must be considered compromised.

**Recommended remediation**

Revoke/rotate the SMTP password immediately. Remove secret values from committed JSON and load them from user secrets, environment variables, or deployment secret storage.

### PRD-002 - Android release uses debug signing key

**Severity:** Critical  
**Production blocker:** Yes  
**Complexity:** Small  
**Affected files:** `frontend/android/app/build.gradle`  
**Affected workflows:** Android release build, app updates, store/internal distribution

**Evidence**

The `release` build type sets `signingConfig signingConfigs.debug`, and the debug keystore is committed at `frontend/android/app/debug.keystore`.

**Impact**

A production APK/AAB signed with a debug key is not trustworthy for long-term release management. Anyone with the repo can produce an update signed with the same debug key.

**Recommended remediation**

Use EAS-managed or Play/App Signing production credentials. Remove debug signing from `release`; keep debug signing only for debug builds.

### PRD-003 - Release manifest permits cleartext traffic

**Severity:** High  
**Production blocker:** Yes  
**Complexity:** Small  
**Affected files:** `frontend/android/app/src/release/AndroidManifest.xml`  
**Affected workflows:** all mobile API calls in release builds

**Evidence**

The release manifest sets `android:usesCleartextTraffic="true"`.

**Impact**

Release builds may allow HTTP API traffic. If a production API URL or override points to HTTP, credentials and employee data can be exposed on the network.

**Recommended remediation**

Set release `usesCleartextTraffic` to `false`; use HTTPS-only production URLs. Keep any HTTP allowance restricted to debug-only manifests.

### PRD-004 - Backend API build fails in this environment

**Severity:** High  
**Production blocker:** Yes  
**Complexity:** Medium  
**Affected files:** `backend/PFE.API/PFE.API.csproj`, `backend/PFE.sln`, local .NET SDK/workload setup  
**Affected workflows:** backend release build

**Evidence**

`dotnet restore backend/PFE.sln` succeeded. `dotnet build backend/PFE.sln --no-restore` and `dotnet build backend/PFE.API/PFE.API.csproj --no-restore` both failed with `0 Warning(s), 0 Error(s)`. Diagnostic output points to project-reference target evaluation failure around `_GetProjectReferenceTargetFrameworkProperties`; no compiler error was emitted.

**Impact**

The API cannot be promoted until a clean backend build is reproducible in CI or the deployment environment.

**Recommended remediation**

Reproduce in a clean shell/CI runner, clear `bin/obj`, verify .NET SDK 8.0.418 workload state, and fix the project-reference/MSBuild failure before deployment.

### PRD-005 - Reverse proxy hardening is incomplete

**Severity:** High  
**Production blocker:** Yes  
**Complexity:** Small  
**Affected files:** `backend/PFE.API/Program.cs`  
**Affected workflows:** production hosting behind Nginx/IIS/Azure/container proxy

**Evidence**

`Program.cs` uses HTTPS redirection outside development, but does not configure `UseForwardedHeaders()` or HSTS.

**Impact**

Behind a TLS-terminating reverse proxy, the API may see requests as HTTP, generate incorrect redirects, mis-handle scheme/host data, and miss browser HSTS protection.

**Recommended remediation**

Configure `ForwardedHeadersOptions` with known proxies/networks, call `UseForwardedHeaders()` early, and enable `UseHsts()` in production.

### PRD-006 - Health/readiness endpoints are missing

**Severity:** High  
**Production blocker:** Yes  
**Complexity:** Small  
**Affected files:** `backend/PFE.API/Program.cs`  
**Affected workflows:** deployment, monitoring, load balancer readiness

**Evidence**

No `AddHealthChecks()` or mapped health endpoint was found.

**Impact**

A host or orchestrator cannot reliably distinguish a live process from an API that cannot reach SQL Server, email, or external workers.

**Recommended remediation**

Add liveness and readiness endpoints. Readiness should validate SQL Server and required production dependencies.

### PRD-007 - Production CORS may not match mobile reality

**Severity:** Medium  
**Production blocker:** No  
**Complexity:** Small  
**Affected files:** `backend/PFE.API/Program.cs`, production environment config  
**Affected workflows:** browser/web clients, SignalR negotiation if used from web

**Evidence**

Production requires explicit HTTPS `Cors:AllowedOrigins`, which is good. React Native native requests do not normally use browser CORS, so this setting primarily affects web clients and browser SignalR.

**Impact**

If a web/admin client is deployed, missing origin configuration will break it. If too broad, browser access could be overexposed.

**Recommended remediation**

Set exact production web origins only. Do not use wildcard origins with credentials.

### PRD-008 - Refresh-token reuse detection is incomplete

**Severity:** High  
**Production blocker:** Yes  
**Complexity:** Medium  
**Affected files:** `backend/PFE.Application/Services/AuthService.cs`, `backend/PFE.Domain/Entities/RefreshToken.cs`  
**Affected workflows:** refresh token, logout, stolen token response

**Evidence**

Refresh tokens are hashed and rotated. `RefreshTokenAsync` looks up only non-revoked, unexpired token hashes. Reuse of an already revoked token returns null, but does not revoke the token family or all active sessions for that user.

**Impact**

If a refresh token is stolen and later reused, the system rejects that one token but does not detect compromise or invalidate descendant sessions.

**Recommended remediation**

Add token family/session identifiers, replacement token references, reuse detection, and revoke all family tokens on detected replay.

### PRD-009 - Refresh endpoint is not rate-limited

**Severity:** Medium  
**Production blocker:** No  
**Complexity:** Small  
**Affected files:** `backend/PFE.API/Controllers/AuthController.cs`  
**Affected workflows:** token refresh

**Evidence**

`login`, password recovery, verify OTP, and reset password use rate-limit policies. `POST /api/Auth/refresh` has no `[EnableRateLimiting]`.

**Impact**

Attackers can hammer refresh-token validation, increasing load and creating noisy auth failures.

**Recommended remediation**

Apply a refresh-specific rate-limit policy keyed by IP and possibly token/user fingerprint.

### PRD-010 - Local Whisper runs synchronously inside HTTP requests

**Severity:** High  
**Production blocker:** Yes  
**Complexity:** Large  
**Affected files:** `backend/PFE.Application/Services/WhisperService.cs`, `backend/whisper/transcribe.py`  
**Affected workflows:** meeting transcription upload

**Evidence**

`TranscribeAsync` saves audio locally, starts `python`, waits up to five minutes, then calls Ollama/fallback before returning.

**Impact**

Concurrent uploads can consume CPU/RAM, tie up ASP.NET request threads, exhaust disk, and produce timeouts under real use.

**Recommended remediation**

Move transcription to a bounded background queue/worker with per-user/concurrent job limits, durable job state, file cleanup policies, and operational metrics.

### PRD-011 - Audio upload validation does not verify file signatures

**Severity:** High  
**Production blocker:** Yes  
**Complexity:** Medium  
**Affected files:** `backend/PFE.Application/Services/WhisperService.cs`  
**Affected workflows:** audio upload/transcription

**Evidence**

Validation checks file size, extension, and content type. It allows `application/octet-stream` and explicitly logs that unrecognized content types are accepted when extension matches.

**Impact**

Non-audio or malformed files can be passed to ffmpeg/Whisper, increasing crash and resource exhaustion risk.

**Recommended remediation**

Validate magic bytes/container via a safe media probing step, reject unknown MIME types in production, and enforce maximum audio duration before transcription.

### PRD-012 - Image upload validation lacks signature/content verification

**Severity:** Medium  
**Production blocker:** No  
**Complexity:** Medium  
**Affected files:** `backend/PFE.Application/Services/CloudinaryService.cs`  
**Affected workflows:** profile image upload, announcement images

**Evidence**

Image validation checks extension and MIME type, then streams to Cloudinary. No image signature or decode validation is performed server-side.

**Impact**

Polyglot or malformed files can be forwarded to Cloudinary. Cloudinary reduces risk, but server-side validation is still incomplete.

**Recommended remediation**

Decode/re-encode images or validate signatures before upload. Strip metadata for profile images if privacy-sensitive.

### PRD-013 - Meeting transcripts and audio retention are undefined

**Severity:** High  
**Production blocker:** Yes  
**Complexity:** Medium  
**Affected files:** `backend/PFE.Application/Services/WhisperService.cs`, `backend/PFE.Domain/Entities/MeetingTranscription.cs`  
**Affected workflows:** meeting workspace, privacy, storage

**Evidence**

Successful audio files are kept under local `Uploads/Meetings`; transcripts, summaries, and tasks are stored without visible retention/deletion policy.

**Impact**

Confidential meeting recordings and transcripts can accumulate indefinitely on disk and in SQL Server.

**Recommended remediation**

Define retention, deletion, and access policies. Prefer private persistent object storage over local web-server disk, and delete raw audio after successful transcription if not required.

### PRD-014 - Android backup is enabled

**Severity:** Medium  
**Production blocker:** No  
**Complexity:** Small  
**Affected files:** `frontend/android/app/src/main/AndroidManifest.xml`  
**Affected workflows:** mobile auth storage and cached user data

**Evidence**

The main manifest sets `android:allowBackup="true"`.

**Impact**

App data may be included in Android backups. Tokens are in SecureStore, but user profile/cache data in AsyncStorage could be backed up.

**Recommended remediation**

Disable backup for production or provide explicit backup rules excluding sensitive app state.

### PRD-015 - Production Android package/application identity is placeholder-like

**Severity:** Medium  
**Production blocker:** No  
**Complexity:** Small  
**Affected files:** `frontend/app.config.js`, `frontend/android/app/build.gradle`, `frontend/google-services.json`  
**Affected workflows:** Android release identity, Firebase/Expo push

**Evidence**

The Android package/applicationId is `com.anonymous.pfemobileapp`.

**Impact**

This is hard to maintain as a real production app identity and may not match organizational naming, Firebase restrictions, or store expectations.

**Recommended remediation**

Choose final package id before first release. Changing it later creates a different app for Android users.

### PRD-016 - EAS staging profile uses local HTTP LAN API

**Severity:** Medium  
**Production blocker:** No  
**Complexity:** Small  
**Affected files:** `frontend/eas.json`  
**Affected workflows:** staging mobile builds

**Evidence**

The staging profile sets `EXPO_PUBLIC_STAGING_API_URL` to an HTTP local-network address.

**Impact**

Internal staging builds may fail outside the developer LAN and may transmit credentials over HTTP.

**Recommended remediation**

Use an HTTPS staging API URL reachable from test devices. Keep LAN URLs in local `.env` only.

### PRD-017 - Expo config will not sync native properties while native folders are committed

**Severity:** Medium  
**Production blocker:** No  
**Complexity:** Medium  
**Affected files:** `frontend/app.config.js`, `frontend/android/`  
**Affected workflows:** EAS/prebuild/native permissions/config

**Evidence**

`npx expo-doctor` reported that the project contains native folders and native config in `app.config.js`; EAS Build will not automatically sync those fields in a non-CNG project.

**Impact**

Permissions, plugins, package metadata, and notification settings may differ between Expo config and actual native Android files.

**Recommended remediation**

Either fully manage native files and keep them manually synchronized, or return to CNG/prebuild workflow intentionally.

### PRD-018 - Expo SDK patch mismatch

**Severity:** Low  
**Production blocker:** No  
**Complexity:** Small  
**Affected files:** `frontend/package.json`, `frontend/package-lock.json`  
**Affected workflows:** frontend dependency health

**Evidence**

`expo-doctor` expected `expo ~54.0.36` but found `54.0.35`.

**Impact**

Minor SDK patch mismatch can leave known Expo fixes unapplied.

**Recommended remediation**

Run `npx expo install --check` and update Expo patch versions before release.

### PRD-019 - Frontend dependencies include high vulnerabilities

**Severity:** High  
**Production blocker:** Yes  
**Complexity:** Medium  
**Affected files:** `frontend/package-lock.json`  
**Affected workflows:** frontend build supply chain

**Evidence**

`npm ci` completed and reported 18 vulnerabilities, including 2 high.

**Impact**

Known vulnerable packages may ship in the build chain or app bundle depending on dependency path.

**Recommended remediation**

Run `npm audit --production` and `npm audit` to identify exact packages, upgrade safe patches first, and document any accepted dev-only risks.

### PRD-020 - Lint and frontend test scripts are missing

**Severity:** Medium  
**Production blocker:** No  
**Complexity:** Medium  
**Affected files:** `frontend/package.json`  
**Affected workflows:** release verification

**Evidence**

`npm run lint` and `npm test` fail because no scripts exist.

**Impact**

Frontend regressions, dead imports, and localization/security mistakes are harder to catch before release.

**Recommended remediation**

Add ESLint and Jest/React Native Testing Library scripts or explicitly document equivalent CI gates.

### PRD-021 - Diagnostic console logs remain in mobile code

**Severity:** Low  
**Production blocker:** No  
**Complexity:** Small  
**Affected files:** multiple frontend files including `DashboardScreen.js`, `DeskScreen.js`, `MeetingWorkspaceScreen.js`, `LeaveRequestScreen.js`  
**Affected workflows:** mobile logs, privacy

**Evidence**

Several `console.log` calls remain. The custom `logger` is disabled outside `__DEV__`, but raw `console.log` calls are not guarded.

**Impact**

Release logs may include request metadata, QR data, base URLs, or business data depending on platform/runtime logging.

**Recommended remediation**

Replace raw `console.*` with the guarded logger or remove diagnostic logs.

### PRD-022 - Production database connection resiliency is not enabled

**Severity:** Medium  
**Production blocker:** No  
**Complexity:** Small  
**Affected files:** `backend/PFE.API/Program.cs`, `backend/PFE.Infrastructure/Data/ApplicationDbContextFactory.cs`  
**Affected workflows:** all SQL Server access

**Evidence**

`UseSqlServer` is configured without `EnableRetryOnFailure`. `dotnet ef migrations list` also reported a transient failure suggestion.

**Impact**

Transient SQL errors during failover/network jitter may surface directly to users.

**Recommended remediation**

Enable SQL Server retry-on-failure with conservative retry settings for production.

### PRD-023 - Admin chatbot Node service is incomplete in repository

**Severity:** Medium  
**Production blocker:** No, unless deployed  
**Complexity:** Medium  
**Affected files:** `backend/app.js`, `backend/routes/adminChatbotRoutes.js`, `backend/controllers/adminChatbotController.js`  
**Affected workflows:** admin chatbot

**Evidence**

`adminChatbotRoutes.js` imports `../middleware/authMiddleware`, but no middleware file was found under `backend/`. No Node `package.json` was found for this service.

**Impact**

If deployed, the service may fail to start. If a different middleware exists outside the repo, production deployment is not reproducible from source.

**Recommended remediation**

Either remove the unused Node service from production deployment or add complete, audited auth middleware and package/deployment files.

### PRD-024 - Some admin/reporting endpoints are unbounded

**Severity:** Medium  
**Production blocker:** No  
**Complexity:** Medium  
**Affected files:** `backend/PFE.Application/Services/AdminUserService.cs`, `GeneralRequestService.cs`, `LeaveService.cs`, `EventService.cs`, several admin controllers  
**Affected workflows:** admin dashboards, approvals, event lists

**Evidence**

Notifications are paginated, but several admin/list workflows still load full result sets with `ToListAsync()` and no page size contract.

**Impact**

Production data growth can slow dashboards, increase memory pressure, and create large mobile payloads.

**Recommended remediation**

Add pagination and date/status filters to admin list endpoints before production data grows.

## Existing protections confirmed

- JWT account-state validation is wired in `Program.cs` `OnTokenValidated`: inactive, rejected, missing, or unsupported-role users fail authentication.
- Swagger is disabled outside development and additionally gated by `Swagger:Enabled`.
- Production startup requires `Jwt:Key`, access-token minutes, database connection, Cloudinary keys, email settings, explicit `AllowedHosts`, and production CORS origins.
- JWT key strength is checked for at least 32 bytes.
- Login errors are sanitized in `AuthController`.
- Password reset avoids email enumeration and uses hashed OTP values with attempt/cooldown/window limits.
- Refresh tokens are hashed at rest and rotated on refresh.
- Axios refresh locking prevents simultaneous mobile 401 responses from making multiple refresh calls.
- Department poll votes have a unique `(PollId, UserId)` index.
- Department poll voter endpoint is Manager-only and service-level department access should be preserved.
- Seat reservations have filtered unique indexes preventing duplicate active/checked-in reservations per seat/date and user/date.
- Seat self-cancellation does not notify the owner; admin cancellation of another user's reservation notifies the owner.
- Room reservation creation uses a serializable transaction and overlap checks.
- Notification read operations filter by authenticated `UserId`.
- SignalR notification hub is `[Authorize]` and joins `user-{id}` / `department-{departmentId}` groups based on JWT claims, not client-supplied group names.
- Expo push tokens are validated and masked in logs.
- Expo push receipts are queued and DeviceNotRegistered tokens are cleared.
- Ollama BaseUrl is configuration-driven and failures fall back without crashing transcription.
- Python process invocation uses `ArgumentList`, not shell interpolation.

## Production configuration checklist

- [ ] Backend environment variables are configured in secret storage.
- [ ] SQL Server production instance is reachable from API host.
- [ ] SQL connection uses least-privilege app account.
- [ ] HTTPS certificate and DNS are configured.
- [ ] Reverse proxy forwards `X-Forwarded-For` and `X-Forwarded-Proto`.
- [ ] API config trusts only known proxy IPs/networks.
- [ ] HSTS is enabled.
- [ ] `AllowedHosts` is explicit.
- [ ] JWT key is strong, secret, and rotated before launch.
- [ ] Cloudinary production cloud/API key/API secret are configured.
- [ ] SMTP production account is rotated and configured through secrets.
- [ ] Expo push project and Firebase/FCM setup match final package id.
- [ ] SignalR endpoint works through HTTPS reverse proxy.
- [ ] Whisper Python environment is installed.
- [ ] `ffmpeg` is installed and available.
- [ ] Faster-whisper model is pre-downloaded or cold-start tested.
- [ ] Ollama is configured or intentionally disabled/fallback-tested.
- [ ] Upload persistence uses durable private storage.
- [ ] Backups and restore procedure are tested.
- [ ] Structured logging, retention, and monitoring are configured.
- [ ] Android release signing uses production credentials.
- [ ] Android release disallows cleartext traffic.

## Required environment variables

### Mandatory

- `ASPNETCORE_ENVIRONMENT`
- `ConnectionStrings__DefaultConnection`
- `Jwt__Key`
- `Jwt__AccessTokenMinutes`
- `Jwt__RefreshTokenDays`
- `Jwt__Issuer`
- `Jwt__Audience`
- `AllowedHosts`
- `Cors__AllowedOrigins__0`
- `Cloudinary__CloudName`
- `Cloudinary__ApiKey`
- `Cloudinary__ApiSecret`
- `Email__SmtpHost`
- `Email__SmtpPort`
- `Email__Username`
- `Email__Password`
- `Email__From`
- `EXPO_PUBLIC_PRODUCTION_API_URL`

### Optional

- `Ollama__BaseUrl`
- `EXPO_PUBLIC_STAGING_API_URL`
- `GEMINI_API_KEY` if the Node admin chatbot is deployed
- `DB_CONNECTION_STRING` if the Node admin chatbot is deployed
- `ConnectionStrings__DefaultConnection` for the Node admin chatbot fallback

### Development-only

- `EXPO_PUBLIC_API_HOST`
- `ASPNETCORE_URLS`
- `DOTNET_ENVIRONMENT`

## Database deployment checklist

- [ ] Take a full production backup.
- [ ] Generate SQL migration script with `dotnet ef migrations script`.
- [ ] Review destructive operations: dropped columns/tables, nullable changes, enum conversions, seed updates.
- [ ] Apply to staging copy with production-like data.
- [ ] Verify row counts and constraints after migration.
- [ ] Test login, requests, reservations, notifications, polls, and transcription on staging.
- [ ] Schedule production maintenance window if schema locks are expected.
- [ ] Apply reviewed migration script, not automatic startup migration.
- [ ] Run validation queries for roles, users, refresh tokens, reservations, notifications, polls.
- [ ] Confirm rollback or restore procedure and estimated restore time.

## Release test matrix

| Scenario | Role | Expected result | Backend evidence | Mobile evidence | Pass |
|---|---|---|---|---|---|
| Register account | Employee | Created inactive, pending admin approval | User `IsActive=false`, no token | Pending approval message | Not tested |
| Login approved user | Employee | Access and refresh tokens returned | Auth logs 200 | Home screen opens | Not tested |
| Login inactive/rejected user | Employee | 403 sanitized message | No token issued | Account inactive message | Not tested |
| Refresh token rotation | Employee | Old token revoked, new token stored | RefreshTokens row revoked/new | Silent retry after 401 | Not tested |
| Logout | Employee | Local tokens cleared, push token cleared | User Expo token null | Login screen | Not tested |
| Forgot/reset password | Employee | OTP email sent if user exists, no enumeration | OTP hashed, attempts counted | OTP/reset flow | Not tested |
| Submit leave | Employee | Server recalculates days | LeaveRequest pending | Request appears | Not tested |
| Approve leave twice | Admin | First succeeds, second conflicts | Serializable/update row count | Conflict alert | Not tested |
| Submit recovery overlap | Employee | Invalid overlap rejected | BadRequest | Validation alert | Not tested |
| Create desk reservation | Employee | One active seat/user/date | Unique indexes enforced | Seat reserved | Not tested |
| Concurrent same-seat booking | Employees | One succeeds, one 409 | DbUpdateException conflict | One conflict alert | Not tested |
| Seat QR check-in replay | Employee | First checks in, repeated returns current | Status checked-in | Stable state | Not tested |
| Self cancel desk | Employee | No notification to self | No owner notification | Reservation removed | Not tested |
| Admin cancel another desk | Admin | Owner notified | Notification row | Owner receives notification | Not tested |
| Create room reservation | Manager | No overlap, active reservation | Serializable transaction | Reservation shown | Not tested |
| Concurrent room overlap | Managers | One succeeds, one conflict | Conflict in transaction | Conflict alert | Not tested |
| QR meeting start duplicate | Manager | Duplicate rejected or stable | InProgress once | No duplicate start | Not tested |
| Finish meeting | Manager owner | Completed once | Status completed | Workspace closes/updates | Not tested |
| Upload meeting audio | Manager/Admin/owner | Transcription or 503 fallback | Transcription row or safe error | Loading/error shown | Not tested |
| View transcription unauthorized | Other user | 403 | Access check blocks | Error alert | Not tested |
| Department feed | Employee | Own department only | Department filter | Feed visible | Not tested |
| Poll vote duplicate | Employee | One vote only | Unique poll-vote index | Vote state stable | Not tested |
| Poll voters | Manager | Own department poll voters only | Manager endpoint 200/403 | Modal shows voters | Partially tested by code path only |
| Poll voters | Employee/Admin | Access denied/not visible | 403 for employee/admin | Button absent | Not tested |
| Notifications list | User | Own notifications paginated | UserId filter | List loads | Not tested |
| Mark another notification read | User | Not found/false | UserId filter | No effect | Not tested |
| SignalR connect | User | User and department groups from claims | Hub connect | Realtime notification | Not tested |
| Expo push invalid token | User | Token rejected/cleared | Warning masked | No crash | Not tested |
| Admin user management | Admin | Admin-only access | 403 for non-admin | Screen hidden/blocked | Not tested |
| Android release API | User | HTTPS production API only | API logs HTTPS | App works on device | Not tested |

## Recommended deployment architecture

### Minimum viable production architecture

- ASP.NET Core API on a single VM/App Service/container host.
- SQL Server managed database or dedicated SQL VM with automated backups.
- Nginx/IIS/Azure proxy terminating HTTPS and forwarding headers.
- Cloudinary for images.
- Local persistent volume for meeting audio only if backups, quotas, and cleanup are configured.
- Whisper, ffmpeg, and Ollama on the same host only for very low pilot load with strict concurrency limits.
- Expo push via Expo service.
- Centralized logs with retention and alerting.

### Safer recommended architecture

- API hosted separately from CPU-heavy transcription workers.
- SQL Server managed service with point-in-time restore.
- Private object storage for audio files with lifecycle retention.
- Background job queue for transcription and insight generation.
- Dedicated worker machine/GPU-capable host for Whisper and Ollama, or managed transcription/AI service after privacy review.
- Reverse proxy with HSTS, forwarded headers, rate limits, and upload size limits.
- CI pipeline running backend build/test, frontend export, expo-doctor, dependency audit, and migration script generation.
- Production secrets in cloud secret manager/EAS secrets, never committed.
- Monitoring for API health, SQL connectivity, disk usage, queue depth, worker failures, push delivery failures, and transcription duration.

**Operational safety of Whisper and Ollama on the same production server:** not safe for more than a very small pilot load unless concurrency is bounded. Both can consume large CPU/RAM; running them inside API request handling can degrade authentication, reservations, and notifications.

## Build and Verification Results

### Backend

- `dotnet restore backend/PFE.sln`: passed after approved network/package access.
- `dotnet build backend/PFE.sln --no-restore`: failed with `0 Warning(s), 0 Error(s)`.
- `dotnet build backend/PFE.API/PFE.API.csproj --no-restore`: failed with `0 Warning(s), 0 Error(s)`.
- `dotnet build backend/PFE.Application.Tests/PFE.Application.Tests.csproj --no-restore`: passed.
- `dotnet test backend/PFE.Application.Tests/PFE.Application.Tests.csproj --no-restore`: exit code 0; no visible test output.
- `dotnet test backend/PFE.sln --no-restore --no-build`: failed/timed out without useful output in this environment.
- `dotnet ef migrations list --project backend/PFE.Infrastructure/PFE.Infrastructure.csproj --startup-project backend/PFE.API/PFE.API.csproj --no-build`: listed migrations, but could not access the local database to determine applied/pending status.

### Frontend

- `npm ci`: first attempt failed on Windows `EPERM`; approved longer rerun passed. Reported 18 vulnerabilities, including 2 high.
- `npm run lint`: failed; missing script.
- `npm test`: failed; missing script.
- `npx expo-doctor`: ran after approved network/package access; 16/18 checks passed, 2 failed.
- `npx expo export --platform android --output-dir artifacts/expo-export-audit`: first attempt failed on Metro `spawn EPERM`; approved rerun passed.

## Final decision

Production deployment should **not proceed yet**.

**Mandatory fixes before deployment:**

- Rotate and remove committed SMTP credentials.
- Configure Android release signing with production credentials.
- Disable Android cleartext traffic in release.
- Make backend API build pass in a clean environment.
- Add forwarded headers and HSTS for production reverse proxy hosting.
- Add health/readiness checks.
- Add a production-safe transcription execution model or strict worker/concurrency controls.
- Review and resolve high frontend dependency vulnerabilities.
- Confirm production API URL is HTTPS and set through EAS secrets.

**Fixes that may be completed immediately after launch if risk is accepted:**

- Add frontend lint/test scripts.
- Add SQL retry-on-failure.
- Add stronger refresh-token family reuse detection.
- Add image/audio signature validation hardening.
- Add pagination to lower-volume admin lists.
- Replace remaining raw mobile `console.log` calls.
- Finalize package naming if the app is not going to public distribution immediately.

**Verification commands to rerun after remediation:**

```bash
dotnet restore backend/PFE.sln
dotnet build backend/PFE.sln --no-restore
dotnet test backend/PFE.sln --no-restore
dotnet ef migrations list --project backend/PFE.Infrastructure/PFE.Infrastructure.csproj --startup-project backend/PFE.API/PFE.API.csproj --no-build

cd frontend
npm ci
npm audit --production
npm run lint
npm test
npx expo-doctor
npx expo export --platform android --output-dir artifacts/expo-export-audit
```

