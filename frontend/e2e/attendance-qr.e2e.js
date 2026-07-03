const { loginFreshAsEmployee } = require("./helpers/app");
const { openDeskScreen } = require("./helpers/navigation");
const { dismissSuccessAlert } = require("./helpers/leave");

async function tapFirstVisibleSeat() {
  const labels = ["A1", "A2", "A3", "B1", "B2"];
  for (const label of labels) {
    try {
      const seat = element(by.id(`desk.seat.${label}`));
      await waitFor(seat).toBeVisible().withTimeout(3000);
      await seat.tap();
      return label;
    } catch {
      // try next seat label
    }
  }
  throw new Error("No available desk seat found on the map");
}

async function ensureReservationReadyForCheckIn() {
  try {
    await waitFor(element(by.id("attendance.checkInButton")))
      .toBeVisible()
      .withTimeout(5000);
    return;
  } catch {
    // No current reservation, create one below.
  }

  await waitFor(element(by.text("Aucun poste réservé")))
    .toBeVisible()
    .withTimeout(15000);

  await tapFirstVisibleSeat();

  await waitFor(element(by.id("desk.confirmReservationButton")))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id("desk.confirmReservationButton")).tap();
  await dismissSuccessAlert();

  await waitFor(element(by.id("attendance.checkInButton")))
    .toBeVisible()
    .withTimeout(15000);
}

async function openFakeQrPanel() {
  await element(by.id("attendance.checkInButton")).tap();
  await waitFor(element(by.id("e2eFakeQrInput")))
    .toBeVisible()
    .withTimeout(5000);
}

async function submitValidFakeQr() {
  await element(by.id("e2eFakeQrButton")).tap();
  await element(by.id("e2eSubmitQrButton")).tap();
  await dismissSuccessAlert();
}

async function checkInWithFakeQr() {
  await openFakeQrPanel();
  await submitValidFakeQr();
  await waitFor(element(by.id("attendance.status")))
    .toBeVisible()
    .withTimeout(15000);
}

describe("ATTENDANCE QR FLOW (E2E mode)", () => {
  it("employee can check in using fake QR", async () => {
    await loginFreshAsEmployee();
    await openDeskScreen();
    await ensureReservationReadyForCheckIn();
    await checkInWithFakeQr();
    await expect(element(by.id("attendance.status"))).toBeVisible();
  });

  it("invalid QR shows error", async () => {
    await loginFreshAsEmployee();
    await openDeskScreen();
    await ensureReservationReadyForCheckIn();
    await openFakeQrPanel();

    await element(by.id("e2eFakeQrInput")).replaceText("INVALID-E2E-QR");
    await element(by.id("e2eSubmitQrButton")).tap();

    await waitFor(element(by.id("feedback.title")))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id("feedback.message"))).toBeVisible();
    await element(by.id("feedback.confirmButton")).tap();
  });

  it("employee can check out", async () => {
    await loginFreshAsEmployee();
    await openDeskScreen();
    await ensureReservationReadyForCheckIn();
    await checkInWithFakeQr();

    await waitFor(element(by.id("attendance.checkOutButton")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("attendance.checkOutButton")).tap();
    await dismissSuccessAlert();

    await waitFor(element(by.id("attendance.status")))
      .toBeVisible()
      .withTimeout(15000);
  });

  it("status updates correctly", async () => {
    await loginFreshAsEmployee();
    await openDeskScreen();
    await ensureReservationReadyForCheckIn();

    await expect(element(by.id("attendance.status"))).toBeVisible();
    await checkInWithFakeQr();
    await expect(element(by.text("checked-in"))).toBeVisible();
  });
});
