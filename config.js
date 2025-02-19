import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env

export const userAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const loginUrl = "https://www.babelio.com/connection.php";
export const libraryUrl = "https://www.babelio.com/mabibliotheque.php";

export const email = process.env.BABELIO_EMAIL;
export const password = process.env.BABELIO_PASSWORD;

console.log("🔍 Checking environment variables:");
console.log(
  "BABELIO_EMAIL:",
  process.env.BABELIO_EMAIL ? "✅ Loaded" : "❌ Not Loaded"
);
console.log(
  "BABELIO_PASSWORD:",
  process.env.BABELIO_PASSWORD ? "✅ Loaded" : "❌ Not Loaded"
);
