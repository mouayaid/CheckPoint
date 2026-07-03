const { loginFreshAsEmployee } = require("./helpers/app");
const {
  openLeaveRequestScreen,
  createLeaveRequestE2e,
  expectLeaveFilterShowsStatus,
  waitForLeaveFilters,
} = require("./helpers/leave");

function formatDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

describe("LEAVE WORKFLOW (E2E mode)", () => {
  it("employee creates leave request", async () => {
    await loginFreshAsEmployee();
    await openLeaveRequestScreen();
    await waitForLeaveFilters();

    const reason = await createLeaveRequestE2e({
      reasonSuffix: "employee-create",
    });

    await waitFor(element(by.text(reason))).toBeVisible().withTimeout(15000);
  });

  it("request appears as Pending", async () => {
    await loginFreshAsEmployee();
    await openLeaveRequestScreen();
    const reason = await createLeaveRequestE2e({
      reasonSuffix: "pending-status",
    });

    await expectLeaveFilterShowsStatus("pending");
    await expect(element(by.text(reason))).toBeVisible();
  });

  it("required fields validation works", async () => {
    await loginFreshAsEmployee();
    await openLeaveRequestScreen();
    await element(by.id("leave.openCreateButton")).tap();

    await waitFor(element(by.id("leave.submitCreateButton")))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id("leave.submitCreateButton"))).toBeDisabled();
  });

  it("invalid date validation works", async () => {
    await loginFreshAsEmployee();
    await openLeaveRequestScreen();
    await element(by.id("leave.openCreateButton")).tap();

    await waitFor(element(by.id("leave.startDateInput")))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id("leave.startDateInput")).replaceText(formatDate(14));
    await element(by.id("leave.endDateInput")).replaceText(formatDate(13));
    await element(by.id("leave.reasonInput")).replaceText("Invalid date e2e");

    await waitFor(element(by.id("leave.validationMessage")))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id("leave.submitCreateButton"))).toBeDisabled();
  });
});
