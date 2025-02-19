import { scrapeBookDetails } from "./bookDetails.js";
import { loadExistingBooks, saveUpdatedBooks } from "./utils.js";
import { libraryUrl } from "./config.js";

async function scrapeLibraryPage(page) {
  console.log("📖 Scraping books from library (1 page only)...");

  return await page.evaluate(() => {
    const statusMapping = {
      "À lire": "To Read",
      "En cours": "Currently Reading",
      Lu: "Read",
      "Pense-bête": "To Download",
    };

    return Array.from(document.querySelectorAll("tbody tr")).map((row) => {
      const rawStatus =
        row.querySelector(".statut .livre_action_status_1")?.innerText.trim() ||
        "Unknown Status";
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
  });
}

export async function scrapeBooks(page) {
  console.log("📖 Scraping first page only...");

  // Scrape first page
  const pageBooks = await scrapeLibraryPage(page);
  if (pageBooks.length === 0) {
    console.log("❌ No books found!");
    return;
  }

  let books = [];
  const existingBooks = loadExistingBooks();

  for (let book of pageBooks) {
    if (!book.link) continue;

    const existingBook = existingBooks.find(
      (b) => b.title === book.title && b.author === book.author
    );

    if (!existingBook) {
      console.log(`📚 New book detected: ${book.title}.`);
      await page.goto(book.link, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      const bookDetails = await scrapeBookDetails(page);
      Object.assign(book, bookDetails);

      await page.goto(libraryUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    } else {
      console.log(
        `📗 Existing book found: ${book.title}, updating status only.`
      );
    }

    books.push(book);
  }

  // Save only the updated/new books
  saveUpdatedBooks(books);
}
