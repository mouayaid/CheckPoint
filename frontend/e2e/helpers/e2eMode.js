const E2E_LAUNCH_ARGS = { e2e: true };

async function launchAppE2E(options = {}) {
  await device.launchApp({
    newInstance: true,
    launchArgs: E2E_LAUNCH_ARGS,
    ...options,
  });
}

async function relaunchE2E() {
  await launchAppE2E({ delete: false });
}

module.exports = {
  E2E_LAUNCH_ARGS,
  launchAppE2E,
  relaunchE2E,
};
