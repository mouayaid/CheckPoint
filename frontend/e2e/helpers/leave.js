const E2E_LEAVE_REASON_PREFIX = "E2E leave automation";

const STATUS_FILTER_BY_KEY = {
  all: "All",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

function uniqueReason(suffix = "") {
  return `${E2E_LEAVE_REASON_PREFIX} ${suffix} ${Date.now()}`.trim();
}

function normalizeStatusFilter(statusKey) {
  return STATUS_FILTER_BY_KEY[String(statusKey).toLowerCase()] || statusKey;
}

async function waitForLeaveFilters() {
  await waitFor(element(by.id("leave.openCreateButton")))
    .toBeVisible()
    .withTimeout(20000);
}

async function dismissSuccessAlert() {
  try {
    await waitFor(element(by.id("feedback.confirmButton")))
      .toBeVisible()
      .withTimeout(8000);
    await element(by.id("feedback.confirmButton")).tap();
    return;
  } catch {
    // Fall back to native alerts used by older screens.
  }

  try {
    await waitFor(element(by.text("OK"))).toBeVisible().withTimeout(3000);
    await element(by.text("OK")).tap();
  } catch {
    // Alert may already be dismissed or use a different label.
  }
}

async function openLeaveRequestScreen() {
  await waitFor(element(by.id("tab.Home")))
    .toBeVisible()
    .withTimeout(15000);

  await waitFor(element(by.id("dashboard.demandsButton")))
    .toBeVisible()
    .whileElement(by.id("dashboard.scrollView"))
    .scroll(300, "down");

  await element(by.id("dashboard.demandsButton")).tap();
  await waitFor(element(by.id("demandMenu.option.leave")))
    .toBeVisible()
    .withTimeout(15000);
  await element(by.id("demandMenu.option.leave")).tap();

  await waitForLeaveFilters();
}

async function createLeaveRequestE2e({
  reason,
  reasonSuffix = "default",
} = {}) {
  const requestReason = reason || uniqueReason(reasonSuffix);

  await waitFor(element(by.id("leave.openCreateButton")))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id("leave.openCreateButton")).tap();

  await waitFor(element(by.id("leave.e2eSetDatesButton")))
    .toBeVisible()
    .withTimeout(5000);

  await element(by.id("leave.e2eSetDatesButton")).tap();
  await element(by.id("leave.reasonInput")).replaceText(requestReason);
  await element(by.id("leave.submitCreateButton")).tap();

  await dismissSuccessAlert();

  await waitForLeaveFilters();
  await element(by.id("leave.filter.Pending")).tap();

  await waitFor(element(by.text(requestReason)))
    .toBeVisible()
    .withTimeout(15000);

  return requestReason;
}

async function expectLeaveFilterShowsStatus(statusKey) {
  const filterKey = normalizeStatusFilter(statusKey);
  const normalizedStatus = String(statusKey).toLowerCase();

  await waitForLeaveFilters();
  await element(by.id(`leave.filter.${filterKey}`)).tap();
  await waitFor(element(by.id(`leave.requestStatus.${normalizedStatus}`)))
    .toBeVisible()
    .withTimeout(10000);
}

module.exports = {
  E2E_LEAVE_REASON_PREFIX,
  uniqueReason,
  normalizeStatusFilter,
  waitForLeaveFilters,
  dismissSuccessAlert,
  openLeaveRequestScreen,
  createLeaveRequestE2e,
  expectLeaveFilterShowsStatus,
};
