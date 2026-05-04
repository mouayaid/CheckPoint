# Dashboard Pending Counts Fix - Progress Tracker

## Approved Plan Summary
- Fix DashboardScreen pending counts mismatch vs ApprovalsScreen
- Primary: Replace direct API calls with service wrappers
- Secondary: Backend role/team filtering (if needed)

## Steps (0/5 Complete)

### 1. [ ] Import services into DashboardScreen.js
   - Add `leaveService` and `adminUserService` imports

### 2. [ ] Replace `fetchPendingLeaveApprovals()` - Use `leaveService.getPendingReviewRequests()`

### 3. [ ] Replace `fetchPendingUserApprovals()` - Use `adminUserService.getPendingUsers()`

### 4. [ ] Test frontend changes
   - `npx expo start`
   - Check dashboard "Vue rapide" counts match ApprovalsScreen
   - Verify no console errors

### 5. [ ] Backend verification (if counts still wrong)
   - Check LeaveService.cs `GetPendingLeaveRequestsForReviewerAsync()`
   - Test Postman: `/api/Leave/pending-review`, `/api/admin/users/pending`

**Next Step**: Edit DashboardScreen.js (Steps 1-3)

**Status**: Ready to implement frontend fix ✅

