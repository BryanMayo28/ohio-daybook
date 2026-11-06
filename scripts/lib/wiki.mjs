// Short performer bios from Wikipedia for events whose listing has no real
// description. Results are cached in cache/wiki.json so each name is looked up
// once, not every morning.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getJSON, sleep } from "./http.mjs";
import { cleanText } from "./normalize.mjs";

const UA = { "User-Agent": "OhioDaybook/1.0 (personal events app; https://github.com/BryanMayo28/ohio-daybook)" };
// The page must describe a performer or a show, so a band called "Palace" never gets the bio of a building.
const PERFORMER = /\b(band|musician|singer|rapper|comedian|comic|duo|trio|group|songwriter|dj|disc jockey|producer|orchestra|ensemble|musical|play|opera|ballet|entertainer|podcast|magician|illusionist|circus|television|tv host|actor|actress|composer|pianist|guitarist|drummer|violinist|choir|tribute act|tour|stage show|dance company|theatre company|record producer|vocalist|hip hop|rock|country|jazz|electronic|pop)\b/i;
const MAX_NEW_LOOKUPS = 350;

function titleFromUrl(u) {
  const m = /wikipedia\.org\/wiki\/([^?#]+)/.exec(u || "");
  return m ? decodeURIComponent(m[1]) : null;
}

const cleanTitle = (name) => String(name || "")
  .replace(/\s*\((touring|tour)\)/gi, "")
  .replace(/\s+(w\/|with|feat\.?|featuring|and special guests?|\+).*$/i, "")
  .replace(/[:\-–|].*$/, "")
  .trim();

export async function enrichWithWikipedia(events, cacheFile) {
  let cache = {};
  try { cache = JSON.parse(await readFile(cacheFile, "utf8")); } catch { /* first run */ }
  let lookups = 0, used = 0;

  async function lookup(info) {
    const exact = titleFromUrl(info.url);
    const title = exact || cleanTitle(info.name);
    if (!title || title.length < 3) return null;
    const key = (exact ? "url:" : "name:") + title.toLowerCase();
    if (key in cache) return cache[key];
    if (lookups >= MAX_NEW_LOOKUPS) return null;
    lookups++;
    let result = null;
    try {
      const body = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`, { retries: 1, headers: UA });
      const okType = body.type === "standard";
      const fits = exact || PERFORMER.test(`${body.description || ""} ${(body.extract || "").slice(0, 200)}`);
      if (okType && fits && body.extract && body.extract.length > 60) {
        result = { d: cleanText(body.extract, 420), wu: body.content_urls?.desktop?.page };
      }
    } catch { result = null; }
    cache[key] = result;
    await sleep(120);
    return result;
  }

  for (const ev of events) {
    const info = ev._wiki;
    delete ev._wiki;
    if (!info || (ev.d && !ev.dg)) continue;
    const hit = await lookup(info);
    if (hit) {
      ev.d = hit.d; ev.dsrc = "Wikipedia"; if (hit.wu) ev.wu = hit.wu;
      delete ev.dg; used++;
    }
  }
  await mkdir(path.dirname(cacheFile), { recursive: true });
  await writeFile(cacheFile, JSON.stringify(cache) + "\n");
  return { lookups, used };
}
