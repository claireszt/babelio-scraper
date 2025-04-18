import { Client } from "@notionhq/client";
import dotenv from "dotenv";
import { logToFile } from "./utils.js";
dotenv.config();

export const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function upsertBookInNotion(book) {
  try {
    const allPages = await getAllPages(process.env.NOTION_DATABASE_ID);

    const normalizeString = (str) =>
      str
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’]/g, "'")
        .toLowerCase();

    const existingPage = allPages.find((page) => {
      const pageTitle =
        page.properties?.Title?.title?.[0]?.text?.content?.toLowerCase() || "";
      const pageAuthor =
        page.properties?.Author?.rich_text?.[0]?.text?.content?.toLowerCase() ||
        "";

      return (
        normalizeString(pageTitle) === normalizeString(book.title || "") &&
        normalizeString(pageAuthor) === normalizeString(book.author || "")
      );
    });

    const notionPayload = {
      properties: {
        Title: {
          title: [{ text: { content: book.title } }],
        },
        Author: {
          rich_text: [{ text: { content: book.author } }],
        },
        Status: {
          status: { name: book.status },
        },
        "Finish Date": book.readDate
          ? { date: { start: book.readDate } }
          : { date: null },
        Series: book.series
          ? { rich_text: [{ text: { content: book.series } }] }
          : undefined,
        "Series Order": book.order
          ? { rich_text: [{ text: { content: book.order } }] }
          : undefined,
        "Data Access": {
          relation: [{ id: process.env.RELATED_BOOKS_PAGE_ID }],
        },
      },
      cover: book.coverImage
        ? {
            type: "external",
            external: { url: book.coverImage },
          }
        : undefined,
    };

    // ✏️ Update if it already exists
    if (existingPage) {
      const changes = getChangedFields(book, existingPage);

      if (changes.length > 0) {
        await notion.pages.update({
          page_id: existingPage.id,
          ...notionPayload,
        });
        console.log(`🔄 Updated ${changes.join(", ")}`);
        logToFile(book, changes, existingPage);
      } else {
        console.log(`✅ No change`);
      }
    } else {
      const summaryText =
        book.summary?.length > 2000
          ? book.summary.slice(0, 1997) + "…"
          : book.summary;

      await notion.pages.create({
        parent: { database_id: process.env.NOTION_DATABASE_ID },
        ...notionPayload,
        children: summaryText
          ? [
              {
                object: "block",
                type: "paragraph",
                paragraph: {
                  rich_text: [
                    {
                      type: "text",
                      text: {
                        content: summaryText,
                      },
                    },
                  ],
                },
              },
            ]
          : [],
      });

      console.log(`✨ Created`);
    }
  } catch (error) {
    console.error("❌ Notion error:", error);
  }
}

function getChangedFields(book, existingPage) {
  const props = existingPage.properties;

  const title = props.Title?.title?.[0]?.text?.content || "";
  const author = props.Author?.rich_text?.[0]?.text?.content || "";
  const status = props.Status?.status?.name || "";
  const date = props["Finish Date"]?.date?.start || null;
  const series = props.Series?.rich_text?.[0]?.text?.content || "";
  const order = props["Series Order"]?.rich_text?.[0]?.text?.content || "";
  const cover = existingPage.cover?.external?.url || "";

  const changes = [];

  const compare = (a, b) => {
    return a !== b;
  };

  if (compare(title, book.title)) {
    changes.push("Title");
  }
  if (compare(author, book.author)) changes.push("Author");
  if (status !== book.status) changes.push("Status");
  if (date !== book.readDate) changes.push("Finish Date");
  if (compare(series, book.series)) changes.push("Series");
  if (compare(order || "", book.order || "")) changes.push("Series Order");
  if (compare(cover, book.coverImage)) changes.push("Cover");

  return changes;
}

async function getAllPages(databaseId) {
  let results = [];
  let cursor = undefined;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });

    results = results.concat(response.results);
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);

  return results;
}
