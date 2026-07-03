const { loginAsEmployee } = require("./helpers/login");
const { E2E_LAUNCH_ARGS } = require("./helpers/e2eMode");
const {
  openProfile,
  openNotifications,
  openGeneralRequests,
  openDemandMenu,
  openDemandType,
  openLeaveRequests,
} = require("./helpers/navigation");
const { sleep } = require("./helpers/wait");

describe("EMPLOYEE ROLE", () => {
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

  it("employee sees employee dashboard", async () => {
    await loginAsEmployee();
    await expect(element(by.id("tab.Home"))).toBeVisible();
    await expect(element(by.id("dashboard.scrollView"))).toBeVisible();
    await expect(element(by.id("dashboard.demandsButton"))).toExist();
  });

  it("employee cannot access admin screens", async () => {
    await loginAsEmployee();
    await expect(element(by.id("tab.Approvals"))).not.toExist();
    await expect(element(by.id("tab.Statistics"))).not.toExist();
    await expect(element(by.id("tab.Announcements"))).not.toExist();
  });

  it("Shows one demands entry on dashboard", async () => {
    await loginAsEmployee();
    await waitFor(element(by.id("dashboard.demandsButton")))
      .toBeVisible()
      .whileElement(by.id("dashboard.scrollView"))
      .scroll(300, "down");
    await expect(element(by.id("dashboard.demandsButton"))).toBeVisible();
  });

  it("Shows the five demand types", async () => {
    await loginAsEmployee();
    await openDemandMenu();
    await expect(element(by.id("demandMenu.option.leave"))).toBeVisible();
    await expect(element(by.id("demandMenu.option.exitAuthorization"))).toBeVisible();
    await expect(element(by.id("demandMenu.option.recovery"))).toBeVisible();
    await expect(element(by.id("demandMenu.option.remoteWork"))).toBeVisible();
    await expect(element(by.id("demandMenu.option.document"))).toBeVisible();
  });

  it("View own leave requests and create button visible", async () => {
    await loginAsEmployee();
    await openLeaveRequests();
    await expect(element(by.id("leave.openCreateButton"))).toBeVisible();
  });

  it("View own general requests and create button visible", async () => {
    await loginAsEmployee();
    await openGeneralRequests();
    await expect(element(by.id("generalRequest.openCreateButton"))).toBeVisible();
  });

  it("Each non-leave demand type opens general request with the right category", async () => {
    await loginAsEmployee();

    await openDemandType("exitAuthorization");
    await expect(element(by.id("generalRequest.category.1"))).toBeVisible();
    await device.pressBack();
    await device.pressBack();

    await openDemandType("recovery");
    await expect(element(by.id("generalRequest.category.2"))).toBeVisible();
    await device.pressBack();
    await device.pressBack();

    await openDemandType("remoteWork");
    await expect(element(by.id("generalRequest.category.3"))).toBeVisible();
    await device.pressBack();
    await device.pressBack();

    await openDemandType("document");
    await expect(element(by.id("generalRequest.category.4"))).toBeVisible();
  });

  it("Create a categorized general request", async () => {
    const title = `Demande generale e2e ${Date.now()}`;

    await loginAsEmployee();
    await openDemandType("recovery");
    await element(by.id("generalRequest.titleInput")).replaceText(title);
    await element(by.id("generalRequest.descriptionInput")).replaceText(
      "Demande creee automatiquement par le test e2e.",
    );
    await element(by.id("generalRequest.submitButton")).tap();

    await waitFor(element(by.text(title)))
      .toBeVisible()
      .withTimeout(20000);
  });

  it("employee can open announcements", async () => {
    await loginAsEmployee();
    await waitFor(element(by.id("dashboard.demandsButton")))
      .toBeVisible()
      .whileElement(by.id("dashboard.scrollView"))
      .scroll(300, "down");

    try {
      await waitFor(element(by.id("dashboard.announcementLatest")))
        .toBeVisible()
        .whileElement(by.id("dashboard.scrollView"))
        .scroll(300, "down");
    } catch {
      await waitFor(element(by.id("dashboard.announcementsEmpty")))
        .toBeVisible()
        .whileElement(by.id("dashboard.scrollView"))
        .scroll(300, "down");
    }
  });

  it("View notifications", async () => {
    await loginAsEmployee();
    await openNotifications();
    await expect(element(by.text("Notifications")).atIndex(0)).toBeVisible();
  });

  it("employee can open profile", async () => {
    await loginAsEmployee();
    await openProfile();
    await expect(element(by.id("auth.logoutButton"))).toExist();
  });
});
