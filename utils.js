import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
// @ts-expect-error: no type definitions for titlecase-french
import titlecaseFrenchModule from "titlecase-french";

// Resolve __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, "books.json");

/**
 * Load existing books.json if available
 * @returns {Array} - Existing books data or an empty array
 */
export function loadExistingBooks() {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  return [];
}

/**
 * Backup the existing books.json before overwriting
 */
export function backupExistingFile() {
  if (fs.existsSync(filePath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(__dirname, `books_${timestamp}.json`);
    fs.renameSync(filePath, backupPath);
    console.log(`🔄 Existing books.json backed up as: ${backupPath}`);
  }
}

/**
 * Saves only modified books to books.json
 * @param {Array} modifiedBooks - Books that were created or updated
 * @param {Array} allBooks - The complete updated book list
 */
export function saveUpdatedBooks(modifiedBooks, allBooks) {
  if (modifiedBooks.length === 0) return; // Skip if no updates

  try {
    fs.writeFileSync(filePath, JSON.stringify(allBooks, null, 2), "utf-8");
  } catch (error) {
    console.error("❌ Error saving books.json:", error);
  }
}

/**
 * Wait for an element to appear and interact with it
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector of the element
 * @param {number} timeout - Maximum wait time (default 5000ms)
 */
export async function waitForAndClick(page, selector, timeout = 5000) {
  try {
    await page.waitForSelector(selector, { timeout });
    await page.click(selector);
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (err) {
    console.log(`⚠️ Element ${selector} not found or not clickable.`);
  }
}

/**
 * Convert date format from DD/MM/YYYY to YYYY-MM-DD
 * @param {string} rawDate - Date in DD/MM/YYYY format
 * @returns {string|null} - Reformatted date or null if invalid
 */
export function formatDate(rawDate) {
  if (!rawDate) return null;
  const [day, month, year] = rawDate.split("/");
  return `${year}-${month}-${day}`;
}

// Extract the `convert` function from the module
const titlecaseFrench = titlecaseFrenchModule.convert;

const knownInitials = ["S.A.", "J.K.", "T.S.", "H.P."]; // Expand as needed

export function capitalizeWords(str) {
  if (!str) return "";

  const standardized = str.replace(/'/g, "’").toLowerCase();

  // ✅ Use the convert function
  let capitalized = postProcessFrenchTitle(titlecaseFrench(standardized));

  // Fix known initials like S.A. Chakraborty
  for (const initials of knownInitials) {
    const regex = new RegExp(
      initials.replace(/\./g, "\\.") + "(?=\\s|$)",
      "gi"
    );
    capitalized = capitalized.replace(regex, initials);
  }

  // Ensure first letter is capitalized
  capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);

  return capitalized;
}

function postProcessFrenchTitle(title) {
  return (
    title
      // Lowercase common French connector words
      .replace(/\b(Des|Du|De|Et)\b/gu, (match) => match.toLowerCase())

      // Fix accented contractions with proper casing
      .replace(/\b(D’)(\p{L})/gu, (_, d, letter) => `d’${letter.toUpperCase()}`)
      .replace(/\b(L’)(\p{L})/gu, (_, l, letter) => `l’${letter.toUpperCase()}`)
      .replace(
        /\b(À L’)(\p{L})/gu,
        (_, àl, letter) => `à l’${letter.toUpperCase()}`
      )

      // Fix lowercase d’/l’ if they got lowercased after titlecase
      .replace(/\b(d’)(\p{L})/gu, (_, d, letter) => `d’${letter.toUpperCase()}`)
      .replace(/\b(l’)(\p{L})/gu, (_, l, letter) => `l’${letter.toUpperCase()}`)
  );
}

export function logToFile(book, changes, notionPage) {
  const logFolder = path.join(__dirname, "logs");
  const logFileName = `${new Date().toISOString().slice(0, 10)}.json`;
  const logFilePath = path.join(logFolder, logFileName);

  if (!fs.existsSync(logFolder)) {
    fs.mkdirSync(logFolder);
  }

  const logs = fs.existsSync(logFilePath)
    ? JSON.parse(fs.readFileSync(logFilePath))
    : [];

  const logEntry = {
    timestamp: new Date().toISOString(),
    title: book.title,
    author: book.author,
    changes: changes.map((field) => ({
      field,
      oldValue: getNotionValue(notionPage, field),
      newValue: getBookValue(book, field),
    })),
  };

  logs.push(logEntry);
  fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), "utf-8");
}

function getNotionValue(notionPage, field) {
  const props = notionPage.properties;
  return (
    {
      Title: props.Title?.title?.[0]?.text?.content || null,
      Author: props.Author?.rich_text?.[0]?.text?.content || null,
      Status: props.Status?.status?.name || null,
      "Finish Date": props["Finish Date"]?.date?.start || null,
      Series: props.Series?.rich_text?.[0]?.text?.content || null,
      "Series Order":
        props["Series Order"]?.rich_text?.[0]?.text?.content || null,
      Cover: notionPage.cover?.external?.url || null,
    }[field] || null
  );
}

function getBookValue(book, field) {
  return (
    {
      Title: book.title,
      Author: book.author,
      Status: book.status,
      "Finish Date": book.readDate,
      Series: book.series,
      "Series Order": book.order,
      Cover: book.coverImage,
    }[field] || null
  );
}
