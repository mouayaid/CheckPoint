async function openTab(tabName) {
  await waitFor(element(by.id(`tab.${tabName}`)))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id(`tab.${tabName}`)).tap();
}

async function openProfile() {
  await waitFor(element(by.id("header.profileButton")))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id("header.profileButton")).tap();
  await waitFor(element(by.id("profile.scrollView")))
    .toBeVisible()
    .withTimeout(15000);
}

async function openProfileLeaveBalance() {
  await openProfile();
  await waitFor(element(by.id("profile.leaveBalanceStat")))
    .toBeVisible()
    .whileElement(by.id("profile.scrollView"))
    .scroll(300, "down");
  await expect(element(by.id("profile.leaveBalanceStat"))).toBeVisible();
}

async function scrollToLogoutButton() {
  const logoutButton = element(by.id("auth.logoutButton"));

  await waitFor(logoutButton).toExist().withTimeout(15000);
  await element(by.id("profile.scrollView")).scrollTo("bottom");
  await waitFor(logoutButton).toBeVisible().withTimeout(10000);
  await expect(logoutButton).toBeVisible();
}

async function openDeskScreen() {
  await waitFor(element(by.id("tab.Home")))
    .toBeVisible()
    .withTimeout(15000);
  await element(by.id("dashboard.reserveDeskButton")).tap();
  await waitFor(element(by.text("AUJOURD'HUI SEULEMENT")))
    .toBeVisible()
    .withTimeout(10000);
}

async function openApprovalsLeaveTab() {
  await openTab("Approvals");
  await waitFor(element(by.id("approvals.tab.general")))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id("approvals.tab.general")).tap();
  await waitFor(element(by.id("approvals.requestType.leave")))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id("approvals.requestType.leave")).tap();
}

async function openDemandMenu() {
  await waitFor(element(by.id("dashboard.demandsButton")))
    .toBeVisible()
    .whileElement(by.id("dashboard.scrollView"))
    .scroll(300, "down");

  await element(by.id("dashboard.demandsButton")).tap();

  await waitFor(element(by.id("demandMenu.option.leave")))
    .toBeVisible()
    .withTimeout(15000);
}

async function openDemandType(typeKey) {
  await openDemandMenu();
  await element(by.id(`demandMenu.option.${typeKey}`)).tap();
}

async function openLeaveRequests() {
  await openDemandType("leave");

  await waitFor(element(by.id("leave.openCreateButton")))
    .toBeVisible()
    .withTimeout(15000);
}

async function openGeneralRequests() {
  await openDemandType("exitAuthorization");

  await waitFor(element(by.id("generalRequest.openCreateButton")))
    .toBeVisible()
    .withTimeout(15000);
}

async function openNotifications() {
  await waitFor(element(by.id("header.notificationsButton")))
    .toBeVisible()
    .withTimeout(10000);

  await element(by.id("header.notificationsButton")).tap();

  await waitFor(element(by.text("Notifications")).atIndex(0))
    .toBeVisible()
    .withTimeout(15000);
}

module.exports = {
  openLeaveRequests,
  openGeneralRequests,
  openDemandMenu,
  openDemandType,
  openTab,
  openNotifications,
  openProfile,
  openProfileLeaveBalance,
  scrollToLogoutButton,
  openDeskScreen,
  openApprovalsLeaveTab,
};
