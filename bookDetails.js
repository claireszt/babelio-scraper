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

  return await page.evaluate(() => {
    // Extract summary
    const summary =
      document.querySelector(".livre_resume")?.innerText.trim() ||
      "No summary available";

    // Extract cover image
    const coverImage =
      document.querySelector("img[itemprop='image']")?.src || "No cover image";

    // Extract author's name
    const author =
      document.querySelector(".livre_auteurs span")?.innerText.trim() ||
      "Unknown Author";

    // Extract series URL and format the series name
    const seriesElement = document.querySelector(".col-8 a[href*='/serie/']");
    let seriesName = null;

    if (seriesElement) {
      // Extract the raw URL and remove the ID at the end
      const seriesUrl = seriesElement.getAttribute("href");
      const seriesSlug = seriesUrl.split("/serie/")[1]?.split("/")[0]; // Take only the name part before "/ID"

      if (seriesSlug) {
        // Replace dashes with spaces and capitalize words
        seriesName = seriesSlug
          .replace(/-/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase()) // Capitalize each word
          .trim();

        // Remove author's name from the series if it appears
        const authorWords = author.split(" ");
        authorWords.forEach((word) => {
          const regex = new RegExp(`\\b${word}\\b`, "gi");
          seriesName = seriesName.replace(regex, "").trim();
        });

        // Clean up extra spaces
        seriesName = seriesName.replace(/\s{2,}/g, " ");
      }
    }

    // Extract book order (if available)
    let bookOrder = null;
    if (seriesElement && seriesElement.nextSibling) {
      const orderMatch =
        seriesElement.nextSibling.textContent.match(/tome (\d+) sur (\d+)/);
      if (orderMatch) {
        bookOrder = `${orderMatch[1]}/${orderMatch[2]}`;
      }
    }

    return {
      summary,
      coverImage,
      series: seriesName,
      order: bookOrder,
    };
  });
}
