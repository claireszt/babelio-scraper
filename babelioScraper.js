const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");

puppeteer.use(StealthPlugin());

// Configuration
const config = {
  email: "claireszt@gmail.com",
  password: "131192",
  loginUrl: "https://www.babelio.com/connection.php",
  libraryUrl: "https://www.babelio.com/mabibliotheque.php",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

async function login(page) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const cookieFrame = page
      .frames()
      .find((frame) => frame.url() === "about:srcdoc");
    if (cookieFrame) {
      console.log("🍪 Handling cookies...");
      const acceptButton = "button.button__acceptAll";
      await cookieFrame.waitForSelector(acceptButton, { timeout: 5000 });
      await cookieFrame.click(acceptButton);
    } else {
      console.log("⚠️ No cookie popup found (or already accepted).");
    }
  } catch (err) {
    console.log("⚠️ No cookie popup found (or already accepted).", err);
  }

  try {
    console.log("🔑 Logging into Babelio...");

    await page.type("input[name='Login']", config.email, { delay: 100 });
    await page.type("input[name='Password']", config.password, { delay: 100 });
    await page.click("input[name='sub_btn']");

    console.log("✅ Login successful! Navigating to Library...");

    await page.goto(config.libraryUrl, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    process.exit(1); // Stop script if login fails
  }
}

async function scrapeLibraryPage(page) {
  console.log("📖 Scraping books from library...");

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

async function clickVoirPlus(page) {
  const voirPlusSelector = "a[onclick^='javascript:voir_plus_a']";
  const isVoirPlusPresent = await page.$(voirPlusSelector);

  if (isVoirPlusPresent) {
    await page.click(voirPlusSelector);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function scrapeBookDetails(page) {
  await clickVoirPlus(page);

  return await page.evaluate(() => {
    return {
      summary:
        document.querySelector(".livre_resume")?.innerText.trim() ||
        "No summary available",
      rating:
        document
          .querySelector(".texte_t2.rating[itemprop='ratingValue']")
          ?.innerText.trim() || "No rating",
      coverImage:
        document.querySelector("img[itemprop='image']")?.src ||
        "No cover image",
    };
  });
}

// **🔄 Main Scraping Function**
async function scrapeBooks(page) {
  console.log("📖 Starting book scraping...");
  let books = [];
  let pageNumber = 1;

  while (true) {
    console.log(`📖 Scraping page ${pageNumber}...`);

    const pageBooks = await scrapeLibraryPage(page);
    if (pageBooks.length === 0) {
      console.log("✅ All pages scraped!");
      break;
    }

    for (let book of pageBooks) {
      if (!book.link) continue;

      // **Check if we already have this book before scraping**
      const existingBooks = loadExistingBooks();
      const existingBook = existingBooks.find(
        (b) => b.title === book.title && b.author === book.author
      );

      if (!existingBook) {
        console.log(`📚 New book detected: ${book.title}, scraping details...`);
        await page.goto(book.link, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });

        const bookDetails = await scrapeBookDetails(page);
        Object.assign(book, bookDetails);

        console.log(`🔍 Scraped details for: ${book.title}`);

        await page.goto(config.libraryUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
      } else {
        console.log(
          `📗 Existing book found: ${book.title}, updating status only.`
        );
      }
    }

    books = books.concat(pageBooks);

    const nextPageUrl = await page.evaluate(() => {
      return (
        document.querySelector(".fleche.icon-next")?.getAttribute("href") ||
        null
      );
    });

    if (!nextPageUrl) {
      console.log("✅ Reached last page.");
      break;
    }

    console.log(`➡️ Navigating to next page...`);
    await page.goto(`https://www.babelio.com/${nextPageUrl}`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    pageNumber++;
  }

  return books;
}

function backupExistingFile(filePath) {
  if (fs.existsSync(filePath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-"); // Create a timestamp
    const backupPath = path.join(__dirname, `books_${timestamp}.json`);
    fs.renameSync(filePath, backupPath);
    console.log(`🔄 Existing books.json backed up as: ${backupPath}`);
  }
}

function saveData(data) {
  const filePath = "books.json";
  backupExistingFile(filePath);
  fs.writeFileSync(filePath, JSON.stringify(books, null, 4), "utf-8");
  console.log(`✅ Scraped ${books.length} books! Data saved in books.json`);
}

function loadExistingBooks() {
  const filePath = "books.json";
  if (fs.existsSync(filePath)) {
    console.log("📂 Loading existing books.json...");
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  return [];
}

function saveUpdatedBooks(newBooks) {
  const filePath = "books.json";

  // Load existing books
  let existingBooks = loadExistingBooks();

  let updatedBooks = [...existingBooks];

  // **Track changes**
  let changesMade = false;

  for (let newBook of newBooks) {
    const existingBookIndex = existingBooks.findIndex(
      (b) => b.title === newBook.title && b.author === newBook.author
    );

    if (existingBookIndex !== -1) {
      let existingBook = existingBooks[existingBookIndex];

      // Check if status or read date changed
      if (
        existingBook.status !== newBook.status ||
        existingBook.readDate !== newBook.readDate
      ) {
        console.log(`🔄 Updating status for: ${newBook.title}`);
        existingBook.status = newBook.status;
        existingBook.readDate = newBook.readDate;
        changesMade = true;
      }
    } else {
      console.log(`➕ New book detected: ${newBook.title}`);
      updatedBooks.push(newBook);
      changesMade = true;
    }
  }

  // Only save if there are changes
  if (changesMade) {
    fs.writeFileSync(filePath, JSON.stringify(updatedBooks, null, 4), "utf-8");
    console.log(`✅ Books.json updated!`);
  } else {
    console.log("✅ No changes detected. Skipping save.");
  }
}

async function scraper() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setUserAgent(config.userAgent);

  await page.goto(config.loginUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await login(page);
  const data = await scrapeBooks(page);
  saveData(data);

  await browser.close();
  console.log("🎉 Scraping complete!");
}

scraper();
