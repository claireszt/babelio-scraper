import StealthPlugin from "puppeteer-extra-plugin-stealth";
import puppeteerExtra from "puppeteer-extra";
import { login } from "./login.js";
import { scrapeBooks } from "./scraper.js";
import { userAgent, loginUrl } from "./config.js";

puppeteerExtra.use(StealthPlugin());

async function scraper() {
  const browser = await puppeteerExtra.launch({
    headless: true, // Run without UI
  });

  const page = await browser.newPage();
  await page.setUserAgent(userAgent);

  try {
    await page.goto(loginUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
  } catch (error) {
    console.error("❌ Error navigating to login:", error);
  }

  await login(page);
  await scrapeBooks(page);

  await browser.close();
  console.log("🎉 All books scraped! Finishing...");
}

async function startScraper() {
  while (true) {
    try {
      console.log("🚀 Starting scraper...");
      await scraper();
      console.log("✅ Scraper completed successfully.");
      break;
    } catch (err) {
      console.error("❌ Scraper failed. Restarting in 5 minutes...", err);
      await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
    }
  }
}

startScraper();
