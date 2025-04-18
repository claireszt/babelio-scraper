import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

export function capitalizeWords(str) {
  if (!str) return "";

  const lowercaseWords = new Set([
    // English articles and conjunctions
    "a",
    "an",
    "and",
    "as",
    "at",
    "but",
    "by",
    "for",
    "in",
    "nor",
    "of",
    "on",
    "or",
    "so",
    "the",
    "to",
    "up",
    "yet",
    "with",

    // French articles and prepositions
    "de",
    "du",
    "des",
    "la",
    "le",
    "les",
    "et",
    "à",
    "au",
    "aux",
    "en",
    "dans",
    "sur",
    "par",
    "pour",
    "avec",
    "sans",

    // Common contractions
    "d",
    "l",
    "qu",
    "n",
    "s",
    "t",
    "m",
    "j",
  ]);

  return str
    .replace(/’/g, "'") // normalize apostrophes to straight first
    .split(/(\s+|-|:|«|»|“|”)/) // keep punctuation separators
    .map((word, i, arr) => {
      const isSeparator = /\s+|-|:|«|»|“|”/.test(word);
      if (isSeparator) return word;

      // Possessive or contraction (e.g. d'Albanie, Wilde's)
      if (word.includes("'")) {
        const [prefix, suffix] = word.split("'");

        const prefixHandled =
          lowercaseWords.has(prefix.toLowerCase()) && i !== 0
            ? prefix.toLowerCase()
            : capitalize(prefix);

        const suffixHandled = capitalize(suffix);

        return `${prefixHandled}’${suffixHandled}`; // return curly apostrophe
      }

      const prev = arr[i - 1];
      const isStart = i === 0 || /[-:«»“”]/.test(prev);
      return isStart || !lowercaseWords.has(word.toLowerCase())
        ? capitalize(word)
        : word.toLowerCase();
    })
    .join("");
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
