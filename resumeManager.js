import fs from "fs";

const file = ".resume.json";

export function saveLastBookKey(key) {
  fs.writeFileSync(file, JSON.stringify({ lastBookKey: key }));
}

export function getLastBookKey() {
  if (!fs.existsSync(file)) return null;

  try {
    const content = fs.readFileSync(file, "utf-8").trim();
    if (!content) return null;

    const data = JSON.parse(content);
    return data.lastBookKey || null;
  } catch (error) {
    console.warn("⚠️ Invalid .resume.json — deleting it:", error.message);
    fs.unlinkSync(file);
    return null;
  }
}

export function clearLastBookKey() {
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export const shouldResume = fs.existsSync(file);
export const lastScrapedKey = shouldResume ? getLastBookKey() : null;
