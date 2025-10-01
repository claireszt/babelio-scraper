import StealthPlugin from "puppeteer-extra-plugin-stealth";
import puppeteerExtra from "puppeteer-extra";
import { login } from "./login.js";
import { scrapeBooks } from "./scraper.js";
import { userAgent, loginUrl } from "./config.js";

puppeteerExtra.use(StealthPlugin());
function isCI() {
  return !!process.env.CI;
}

function getLaunchOptions() {
  const options = {
    headless: "new",
    protocolTimeout: 180000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1366,768",
    ],
  };
  if (isCI() && process.env.PUPPETEER_EXECUTABLE_PATH) {
    options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  return options;
}

async function startScraper() {
  let attempt = 0;
  const maxAttempts = 5;

  while (attempt < maxAttempts) {
    const browser = await puppeteerExtra.launch(getLaunchOptions());
    const page = await browser.newPage();

    // 🔎 Debug wiring
    page.setDefaultNavigationTimeout(isCI() ? 120000 : 60000);
    page.setDefaultTimeout(isCI() ? 120000 : 60000);

    page.on("console", (msg) => console.log("🖥️ page:", msg.text()));
    page.on("requestfailed", (req) =>
      console.log("📵 request failed:", req.url(), req.failure()?.errorText)
    );
    page.on("response", async (res) => {
      if (res.request().resourceType() === "document") {
        console.log("📄 main doc status:", res.status(), res.url());
      }
    });

    try {
      await page.setUserAgent(userAgent);
      await page.setViewport({ width: 1366, height: 768 });

      console.log("🚀 Starting scraper...");
      const resp = await page.goto(loginUrl, {
        waitUntil: "domcontentloaded",
        timeout: isCI() ? 120000 : 60000,
      });

      const status = resp?.status?.() ?? 0;
      if (status && status >= 400) {
        throw new Error(`Main navigation returned HTTP ${status}`);
      }

      await login(page);
      await scrapeBooks(page);

      console.log("✅ Scraper completed successfully.");
      await browser.close();
      break;
    } catch (err) {
      attempt++;
      console.error(`❌ Scraper crashed (attempt ${attempt})`);
      console.error(err);
      await browser.close();

      if (attempt < maxAttempts) {
        console.log("🔁 Restarting browser and trying again in 1 minute...");
        await new Promise((res) => setTimeout(res, 60 * 1000));
      } else {
        console.error("❌ Max attempts reached. Giving up.");
        process.exit(1);
      }
    }
  }
  console.log("🎉 All books scraped! Finishing...");
}

startScraper();
