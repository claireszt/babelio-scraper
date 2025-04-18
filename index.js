import StealthPlugin from "puppeteer-extra-plugin-stealth";
import puppeteerExtra from "puppeteer-extra";
import { login } from "./login.js";
import { scrapeBooks } from "./scraper.js";
import { userAgent, loginUrl } from "./config.js";

puppeteerExtra.use(StealthPlugin());

function getLaunchOptions() {
  const isCI = !!process.env.CI;

  const options = {
    headless: true,
    protocolTimeout: 180000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  };

  if (isCI && process.env.PUPPETEER_EXECUTABLE_PATH) {
    options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  return options;
}

async function startScraper() {
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    const browser = await puppeteerExtra.launch(getLaunchOptions());
    const page = await browser.newPage();

    try {
      await page.setUserAgent(userAgent);
      console.log("🚀 Starting scraper...");

      await page.goto(loginUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await login(page);
      await scrapeBooks(page);

      console.log("✅ Scraper completed successfully.");
      await browser.close();
      break;
    } catch (err) {
      attempt++;
      console.error(`❌ Scraper crashed (attempt ${attempt}):`, err.message);
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
