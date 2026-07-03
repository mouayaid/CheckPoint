const { requireEnv } = require("./env");

async function expectOnLoginScreen() {
  await waitFor(element(by.id("auth.emailInput")))
    .toBeVisible()
    .withTimeout(60000);

  await expect(element(by.id("auth.emailInput"))).toBeVisible();
  await expect(element(by.id("auth.passwordInput"))).toBeVisible();
  await expect(element(by.id("auth.loginButton"))).toBeVisible();
}

async function login({ email, password }) {
  await expectOnLoginScreen();

  await element(by.id("auth.emailInput")).replaceText(email);
  await element(by.id("auth.passwordInput")).replaceText(password);
  await element(by.id("auth.loginButton")).tap();
}

async function loginAsEmployee() {
  return login({
    email: requireEnv("E2E_EMPLOYEE_EMAIL"),
    password: requireEnv("E2E_EMPLOYEE_PASSWORD"),
  });
}

async function loginAsManager() {
  return login({
    email: requireEnv("E2E_MANAGER_EMAIL"),
    password: requireEnv("E2E_MANAGER_PASSWORD"),
  });
}

async function loginAsAdmin() {
  return login({
    email: requireEnv("E2E_ADMIN_EMAIL"),
    password: requireEnv("E2E_ADMIN_PASSWORD"),
  });
}

module.exports = {
  login,
  loginAsEmployee,
  loginAsManager,
  loginAsAdmin,
  expectOnLoginScreen,
};
