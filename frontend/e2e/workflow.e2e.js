const {
  loginFreshAsEmployee,
  loginFreshAsManager,
  loginFreshAsAdmin,
} = require("./helpers/app");
const { openProfile } = require("./helpers/navigation");
const { openLeaveRequestScreen, createLeaveRequestE2e } = require("./helpers/leave");

describe("COMPLETE WORKFLOWS (high-level)", () => {
  it("Employee creates leave request", async () => {
    await loginFreshAsEmployee();
    await openLeaveRequestScreen();

    const reason = await createLeaveRequestE2e({ reasonSuffix: "workflow-create" });

    await expect(element(by.text(reason))).toExist();
  });

  it("Admin can reach approvals and statistics after login", async () => {
    await loginFreshAsAdmin();
    await expect(element(by.id("tab.Approvals"))).toBeVisible();
    await expect(element(by.id("tab.Statistics"))).toBeVisible();
  });

  it("Employee leave balance visible in profile after login", async () => {
    await loginFreshAsEmployee();
    await openProfile();
    await waitFor(element(by.id("profile.leaveBalanceStat")))
      .toExist()
      .withTimeout(10000);
  });

  it("Manager can login and reach home", async () => {
    await loginFreshAsManager();
    await expect(element(by.id("tab.Home"))).toBeVisible();
  });
});
