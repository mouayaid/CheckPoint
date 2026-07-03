const { E2E_LAUNCH_ARGS } = require("./e2eMode");
const { sleep } = require("./wait");
const {
  loginAsEmployee,
  loginAsManager,
  loginAsAdmin,
} = require("./login");

async function resetApp() {
  await device.launchApp({
    newInstance: true,
    delete: true,
    launchArgs: E2E_LAUNCH_ARGS,
    permissions: { notifications: "YES", camera: "YES" },
  });

  await sleep(3000);
}

async function loginFreshAsEmployee() {
  await resetApp();
  await loginAsEmployee();
}

async function loginFreshAsManager() {
  await resetApp();
  await loginAsManager();
}

async function loginFreshAsAdmin() {
  await resetApp();
  await loginAsAdmin();
}

module.exports = {
  resetApp,
  loginFreshAsEmployee,
  loginFreshAsManager,
  loginFreshAsAdmin,
};
