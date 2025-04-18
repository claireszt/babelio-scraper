import { capitalizeWords } from "./utils.js";

export async function scrapeBookDetails(page) {
  const voirPlusSelector = "a[onclick^='javascript:voir_plus_a']";

  // Ensure "Voir plus" is clicked
  const voirPlusExists = await page.$(voirPlusSelector);
  if (voirPlusExists) {
    await page.evaluate((selector) => {
      document.querySelector(selector)?.click();
    }, voirPlusSelector);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return await page
    .evaluate(() => {
      const summary =
        document.querySelector(".livre_resume")?.innerText.trim() ||
        "No summary available";
      const coverImage =
        document.querySelector("img[itemprop='image']")?.src ||
        "No cover image";
      const author =
        document.querySelector(".livre_auteurs span")?.innerText.trim() ||
        "Unknown Author";

      const seriesElement = document.querySelector(".col-8 a[href*='/serie/']");
      let seriesName = null;
      let bookOrder = null;

      if (seriesElement) {
        const authorName = author.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const authorRegex = new RegExp(`\\s*\\(${authorName}\\)$`, "i");
        seriesName = seriesName.replace(authorRegex, "").trim();

        const rawTextNode =
          seriesElement.nextSibling?.textContent?.trim() || "";
        const orderMatch = rawTextNode.match(/tome ([\d.]+) sur (\d+)/i);

        if (seriesName && orderMatch) {
          bookOrder = `${orderMatch[1]}/${orderMatch[2]}`;
        }
      }

      return {
        summary,
        coverImage,
        series: seriesName,
        order: bookOrder,
      };
    })
    .then((bookData) => {
      return {
        ...bookData,
        series: capitalizeWords(bookData.series),
        order: bookData.order,
      };
    });
}
