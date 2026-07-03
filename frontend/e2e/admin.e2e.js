const { loginAsAdmin } = require("./helpers/login");
const { E2E_LAUNCH_ARGS } = require("./helpers/e2eMode");
const { openTab } = require("./helpers/navigation");
const { loginFreshAsEmployee, loginFreshAsAdmin } = require("./helpers/app");
const {
  openLeaveRequestScreen,
  createLeaveRequestE2e,
  dismissSuccessAlert,
} = require("./helpers/leave");
const { sleep } = require("./helpers/wait");

async function openAdminLeaveApprovals() {
  await openTab("Approvals");
  await waitFor(element(by.id("approvals.tab.general")))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id("approvals.tab.general")).tap();
  await waitFor(element(by.id("approvals.requestType.leave")))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id("approvals.requestType.leave")).tap();
}

async function createPendingLeave(reasonSuffix) {
  await loginFreshAsEmployee();
  await openLeaveRequestScreen();
  return createLeaveRequestE2e({ reasonSuffix });
}

describe("ADMIN ROLE", () => {
  beforeEach(async () => {
    await device.launchApp({
      newInstance: true,
      delete: true,
      launchArgs: E2E_LAUNCH_ARGS,
      permissions: { notifications: "YES", camera: "YES" },
    });
    await sleep(3000);
  });

  afterEach(async () => {
    await device.terminateApp();
  });

  it("admin can see statistics", async () => {
    await loginAsAdmin();
    await openTab("Statistics");
    await expect(element(by.id("tab.Statistics"))).toBeVisible();
  });

  it("admin can access announcements management if implemented", async () => {
    await loginAsAdmin();
    await openTab("Announcements");
    await expect(element(by.id("announcements.openCreateButton"))).toBeVisible();
  });

  it("admin can access requests", async () => {
    await loginAsAdmin();
    await openAdminLeaveApprovals();
    await expect(element(by.id("approvals.tab.general"))).toBeVisible();
  });

  it("admin can approve request", async () => {
    const reason = await createPendingLeave("admin-approve");

    await loginFreshAsAdmin();
    await openAdminLeaveApprovals();
    await waitFor(element(by.text(reason))).toBeVisible().withTimeout(20000);
    await element(by.text(reason)).tap();
    await waitFor(element(by.id("leave.adminValidateButton")))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id("leave.adminValidateButton")).tap();
    await dismissSuccessAlert();
  });

  it("admin can reject request", async () => {
    const reason = await createPendingLeave("admin-reject");

    await loginFreshAsAdmin();
    await openAdminLeaveApprovals();
    await waitFor(element(by.text(reason))).toBeVisible().withTimeout(20000);
    await element(by.text(reason)).tap();
    await waitFor(element(by.id(/^approvals\.leaveReject\./)))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id(/^approvals\.leaveReject\./)).tap();
    await dismissSuccessAlert();
  });
});
