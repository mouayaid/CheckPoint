const { openProfile, scrollToLogoutButton } = require("./navigation");
const { waitForVisibleById } = require("./wait");

async function logoutFromProfile() {
  await openProfile();
  await scrollToLogoutButton();
  await element(by.id("auth.logoutButton")).tap();
  await waitForVisibleById("auth.loginButton", 10000);
}

module.exports = {
  logoutFromProfile,
};
