import { scrapeBookDetails } from "./bookDetails.js";
import { libraryUrl } from "./config.js";
import { upsertBookInNotion } from "./notion.js";
import { capitalizeWords } from "./utils.js";
import {
  getLastBookKey,
  saveLastBookKey,
  clearLastBookKey,
} from "./resumeManager.js";

export async function scrapeBooks(page) {
  const processed = new Set();
  let bookCount = 0;
  let totalBooks = await getTotalBooks(page);

  const lastScrapedKey = getLastBookKey();
  const shouldResume = !!lastScrapedKey;
  let foundLast = !shouldResume;
  let currentPage = libraryUrl;

  while (true) {
    const pageLoaded = await safeGoto(page, currentPage);
    if (!pageLoaded) {
      throw new Error(`❌ Failed to load library page: ${currentPage}`);
    }

    const pageBooks = await scrapeLibraryPage(page);

    if (pageBooks.length === 0 || pageBooks[0].title === "Unknown Title") {
      const errorMsg = "❌ 'Unknown Title' detected. Restarting scraper...";
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    for (let book of pageBooks) {
      const bookKey = `${book.title.toLowerCase()}::${book.author.toLowerCase()}`;

      if (!foundLast) {
        if (bookKey === lastScrapedKey) {
          foundLast = true;
          bookCount++;
          console.log(`⏩ Skipping ${book.title}`);
          console.log(`🔁 Resuming`);
          continue;
        } else {
          bookCount++;
          console.log(`⏩ Skipping ${book.title}`);
          continue;
        }
      }

      if (processed.has(bookKey)) continue;

      bookCount++;
      console.log(
        `${bookCount}/${totalBooks} 📖 ${book.title}, ${book.author}`
      );

      if (!book.link) {
        console.warn(`⚠️ No link for "${book.title}"`);
        continue;
      }

      const currentLibraryPage = page.url();
      const bookPageLoaded = await safeGoto(page, book.link);
      if (!bookPageLoaded) continue;

      try {
        const bookDetails = await scrapeBookDetails(page);
        Object.assign(book, bookDetails);
        await upsertBookInNotion(book);
        processed.add(bookKey);
        saveLastBookKey(bookKey);
      } catch (error) {
        console.error("❌ Error handling book:", error);
      }

      await safeGoto(page, currentLibraryPage);
    }

    const nextPageUrl = await page.evaluate(() => {
      return (
        document.querySelector("a.fleche.icon-next")?.getAttribute("href") ||
        null
      );
    });

    if (!nextPageUrl) break;
    currentPage = `https://www.babelio.com/${nextPageUrl}`;
  }

  clearLastBookKey();
}

async function getTotalBooks(page) {
  return await page.evaluate(() => {
    const booksLink = document.querySelector(
      'a[href="/mabibliotheque.php"].current.menu_link'
    );
    const match = booksLink?.innerText?.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  });
}

async function scrapeLibraryPage(page) {
  return await page
    .evaluate(() => {
      const statusMapping = {
        "À lire": "To Read",
        "En cours": "Currently Reading",
        Lu: "Read",
        Abandonné: "Abandoned",
      };

      return Array.from(document.querySelectorAll("tbody tr")).map((row) => {
        const rawStatus =
          row
            .querySelector(".statut .livre_action_status_1")
            ?.innerText.trim() || "Unknown Status";
        const status = statusMapping[rawStatus] || rawStatus;

        let readDate = null;
        if (status === "Read") {
          const rawDate = row
            .querySelector(".datepicker_fin")
            ?.getAttribute("value");
          if (rawDate) {
            const [day, month, year] = rawDate.split("/");
            readDate = `${year}-${month}-${day}`;
          }
        }

        return {
          title:
            row.querySelector(".titre_livre h2")?.innerText.trim() ||
            "Unknown Title",
          author:
            row.querySelector(".auteur")?.innerText.trim() || "Unknown Author",
          status,
          readDate,
          link: row.querySelector(".titre_livre a")?.href || null,
        };
      });
    })
    .then((books) =>
      books.map((book) => ({
        ...book,
        title: capitalizeWords(book.title),
        author: capitalizeWords(book.author),
      }))
    );
}

async function safeGoto(page, url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      return true;
    } catch (error) {
      if (attempt === retries) {
        console.error(
          `❌ Failed to navigate to ${url} after ${retries} attempts`
        );
        return false;
      }
      await new Promise((res) => setTimeout(res, 2000));
    }
  }
}
