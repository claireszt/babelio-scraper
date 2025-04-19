import { email, password, libraryUrl } from "./config.js";

async function handleCookies(page) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const cookieFrame = page
      .frames()
      .find((frame) => frame.url() === "about:srcdoc");
    if (cookieFrame) {
      console.log("🍪 Handling cookies...");
      await cookieFrame.waitForSelector("button.button__acceptAll", {
        timeout: 5000,
      });
      await cookieFrame.click("button.button__acceptAll");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } else {
      console.log("⚠️ No cookie popup found (or already accepted).");
    }
  } catch (err) {
    console.log("⚠️ No cookie popup found (or already accepted).", err);
  }
}

export async function login(page) {
  try {
    await handleCookies(page);

    console.log("🔑 Logging into Babelio...");

    await page.waitForSelector("input[name='Login']", { timeout: 10000 });
    await page.waitForSelector("input[name='Password']", { timeout: 10000 });

    await page.type("input[name='Login']", email, { delay: 100 });
    await page.type("input[name='Password']", password, { delay: 100 });

    await page.click("input[name='sub_btn']");

    console.log("✅ Login successful! Navigating to Library...");

    await page.goto(libraryUrl, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
  } catch (err) {
    console.error("❌ Login or navigation error:", err);
    throw err;
  }
}
