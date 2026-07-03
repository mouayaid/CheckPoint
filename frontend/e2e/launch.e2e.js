const { resetApp } = require("./helpers/app");
const { expectOnLoginScreen } = require("./helpers/login");

describe("LAUNCH", () => {
  it("app launches successfully", async () => {
    await resetApp();
    await expectOnLoginScreen();
  });

  it("E2E mode is active", async () => {
    await resetApp();
    await waitFor(element(by.id("e2e.modeActive")))
      .toExist()
      .withTimeout(10000);
  });
});
