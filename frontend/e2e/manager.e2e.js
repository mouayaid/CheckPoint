const { loginAsManager } = require("./helpers/login");
const { E2E_LAUNCH_ARGS } = require("./helpers/e2eMode");
const { openTab } = require("./helpers/navigation");
const { sleep } = require("./helpers/wait");

describe("MANAGER ROLE", () => {
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

  it("manager can see home", async () => {
    await loginAsManager();
    await openTab("Home");
    await expect(element(by.id("tab.Home"))).toBeVisible();
  });

  it("manager cannot access requests", async () => {
    await loginAsManager();
    await expect(element(by.id("tab.Approvals"))).not.toExist();
  });
});
