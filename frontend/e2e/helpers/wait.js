async function waitForVisibleById(testID, timeout = 15000) {
  await waitFor(element(by.id(testID))).toBeVisible().withTimeout(timeout);
}

async function waitForVisibleByText(text, timeout = 15000) {
  await waitFor(element(by.text(text))).toBeVisible().withTimeout(timeout);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  waitForVisibleById,
  waitForVisibleByText,
  sleep,
};
