const {
  login,
  loginAsEmployee,
  loginAsManager,
  loginAsAdmin,
} = require("./helpers/login");
const { E2E_LAUNCH_ARGS } = require("./helpers/e2eMode");
const { logoutFromProfile } = require("./helpers/logout");
const { sleep } = require("./helpers/wait");

describe("AUTHENTICATION", () => {
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

  it("employee can login", async () => {
    await loginAsEmployee();
    await expect(element(by.id("tab.Home"))).toBeVisible();
  });

  it("manager can login", async () => {
    await loginAsManager();
    await expect(element(by.id("tab.Home"))).toBeVisible();
  });

  it("admin can login", async () => {
    await loginAsAdmin();
    await expect(element(by.id("tab.Home"))).toBeVisible();
  });

  it("wrong credentials show error", async () => {
    await login({
      email: "invalid@example.com",
      password: "wrong-password",
    });

    await waitFor(element(by.id("feedback.title")))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id("feedback.message"))).toBeVisible();
    await element(by.id("feedback.confirmButton")).tap();
    await expect(element(by.id("auth.emailInput"))).toBeVisible();
  });

  it("logout works", async () => {
    await loginAsEmployee();
    await logoutFromProfile();
    await expect(element(by.id("auth.loginButton"))).toBeVisible();
  });
});
