const REQUIRED_E2E_ENV_VARS = [
  "E2E_EMPLOYEE_EMAIL",
  "E2E_EMPLOYEE_PASSWORD",
  "E2E_MANAGER_EMAIL",
  "E2E_MANAGER_PASSWORD",
  "E2E_ADMIN_EMAIL",
  "E2E_ADMIN_PASSWORD",
];

function getEnv(name) {
  return process.env[name];
}

function requireEnv(name) {
  const value = getEnv(name);
  if (!value) {
    throw new Error(
      `Missing ${name}. Set all Detox credentials before running E2E tests: ${REQUIRED_E2E_ENV_VARS.join(", ")}`,
    );
  }
  return value;
}

function validateRequiredEnv() {
  const missing = REQUIRED_E2E_ENV_VARS.filter((name) => !getEnv(name));
  if (missing.length > 0) {
    throw new Error(
      [
        "Missing required Detox environment variables:",
        missing.map((name) => `- ${name}`).join("\n"),
        "",
        "Set these before running: npm run detox:test:android",
      ].join("\n"),
    );
  }
}

module.exports = {
  REQUIRED_E2E_ENV_VARS,
  getEnv,
  requireEnv,
  validateRequiredEnv,
};
