const { validateRequiredEnv } = require("./helpers/env");

jest.setTimeout(180000);

beforeAll(() => {
  validateRequiredEnv();
});
