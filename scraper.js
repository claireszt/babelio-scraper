import { scrapeBookDetails } from "./bookDetails.js";
import { loadExistingBooks, saveUpdatedBooks } from "./utils.js";
import { libraryUrl } from "./config.js";

async function getTotalBooks(page) {
  return await page.evaluate(() => {
    const booksLink = document.querySelector(
      'a[href="/mabibliotheque.php"].current.menu_link'
    );
    if (booksLink) {
      const match = booksLink.innerText.match(/\d+/);
      return match ? parseInt(match[0], 10) : null;
    }
    return null;
  });
}

async function scrapeLibraryPage(page) {
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
  let books = loadExistingBooks();
  let pageNumber = 1;
  let bookCount = 0;

  const totalBooks = await getTotalBooks(page);

  while (true) {
    const pageBooks = await scrapeLibraryPage(page);
    if (pageBooks.length === 0) break;

    let booksToSave = [];

    for (let book of pageBooks) {
      bookCount++;

      const existingBook = books.find(
        (b) => b.title === book.title && b.author === book.author
      );

      let changes = [];

      if (!existingBook) {
        console.log(
          `${bookCount}/${totalBooks} 📚 Creating: ${book.title}, ${book.author}`
        );

        try {
          await page.goto(book.link, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });
        } catch (error) {
          console.error("❌ Error navigating to book page:", error);
        }

        const bookDetails = await scrapeBookDetails(page);
        Object.assign(book, bookDetails);

        books.push(book);
        booksToSave.push(book);
        changes.push("new book");
      } else {
        if (existingBook.status !== book.status) {
          existingBook.status = book.status;
          changes.push("status");
        }
        if (existingBook.readDate !== book.readDate) {
          existingBook.readDate = book.readDate;
          changes.push("read date");
        }
        if (existingBook.rating !== book.rating) {
          existingBook.rating = book.rating;
          changes.push("rating");
        }

        if (changes.length > 0) {
          console.log(
            `${bookCount}/${totalBooks} 🔄 Updating ${changes.join(", ")}: ${
              book.title
            }, ${book.author}`
          );
          booksToSave.push(existingBook);
        } else {
          console.log(
            `${bookCount}/${totalBooks} ✅ No change: ${book.title}, ${book.author}`
          );
        }
      }

      if (booksToSave.length > 0) {
        saveUpdatedBooks(booksToSave, books);
        booksToSave = [];
      }

      try {
        await page.goto(libraryUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
      } catch (error) {
        console.error("❌ Error navigating to library:", error);
      }
    }

    const nextPageUrl = await page.evaluate(
      () =>
        document.querySelector(".fleche.icon-next")?.getAttribute("href") ||
        null
    );
    if (!nextPageUrl) break;

    try {
      await page.goto(`https://www.babelio.com/${nextPageUrl}`, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });
    } catch (error) {
      console.error("❌ Error navigating to next page:", error);
    }

    pageNumber++;
  }
}
