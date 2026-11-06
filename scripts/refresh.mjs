#!/usr/bin/env node
// Pulls events for every city in config/cities.json and writes public/data/<city>.json.
//
//   TICKETMASTER_API_KEY=... SEATGEEK_CLIENT_ID=... node scripts/refresh.mjs
//
// Each source is optional: a missing key or a failing feed is logged and skipped.
// If a source fails, still-upcoming events from the previous run are kept so the
// app never goes blank because one source had a bad morning.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fetchTicketmaster } from "./sources/ticketmaster.mjs";
import { fetchSeatGeek } from "./sources/seatgeek.mjs";
import { fetchICal } from "./sources/ical.mjs";
import { fetchTribe } from "./sources/tribe.mjs";
import { enrichWithWikipedia } from "./lib/wiki.mjs";
import { makeEvent, mergeEvents, minutesFromLabel, todayIn, addDays, priceFromText } from "./lib/normalize.mjs";
import { redact } from "./lib/http.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "data");

async function readJSON(file, fallback) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
}

async function main() {
  const settings = await readJSON(path.join(root, "config", "cities.json"));
  const curated = await readJSON(path.join(root, "config", "curated-events.json"), {});
  const tz = settings.timezone;
  const start = todayIn(tz);
  const end = addDays(start, settings.windowDays - 1);
  const tmKey = process.env.TICKETMASTER_API_KEY;
  const sgId = process.env.SEATGEEK_CLIENT_ID;
  if (!tmKey) console.warn("! TICKETMASTER_API_KEY not set: skipping Ticketmaster");
  if (!sgId) console.warn("! SEATGEEK_CLIENT_ID not set: skipping SeatGeek");

  await mkdir(outDir, { recursive: true });
  const status = { updated: new Date().toISOString(), window: { start, end }, cities: {} };
  const inWindow = (e) => (e.e || e.s) >= start && e.s <= end;

  for (const city of settings.cities) {
    const collected = [];
    const report = {};
    let anyFailed = false;

    const run = async (label, fn) => {
      try {
        const evs = await fn();
        collected.push(...evs);
        report[label] = evs.length;
        console.log(`  ${city.name} · ${label}: ${evs.length}`);
      } catch (err) {
        anyFailed = true;
        report[label] = `error: ${redact(err.message)}`;
        console.warn(`  ${city.name} · ${label} failed: ${redact(err.message)}`);
      }
    };

    console.log(`${city.name}`);
    if (tmKey) await run("Ticketmaster", () => fetchTicketmaster(city, settings, { apiKey: tmKey, start, end }));
    if (sgId) await run("SeatGeek", () => fetchSeatGeek(city, settings, { clientId: sgId, start, end }));
    for (const feed of city.feeds || city.icalFeeds || []) {
      const opts = { start, end, timeZone: tz };
      await run(feed.name, () => (feed.type === "tribe" ? fetchTribe(city, settings, feed, opts) : fetchICal(city, feed, opts)));
    }

    // Hand-picked events (markets, festivals, light shows) that ticketing APIs miss.
    const picks = (curated[city.id] || [])
      .map((e) => {
        const price = e.p ? { p: e.p, pm: e.pm } : priceFromText(e.d);
        return makeEvent({ ...e, m: e.m ?? minutesFromLabel(e.t), p: price?.p, pm: price?.pm, src: "Curated" });
      })
      .filter(inWindow);
    collected.push(...picks);
    report.Curated = picks.length;

    const outFile = path.join(outDir, `${city.id}.json`);
    if (anyFailed || (!tmKey && !sgId)) {
      // Keep last run's events only from the sources that failed this time.
      const failed = new Set(Object.entries(report).filter(([, v]) => typeof v === "string").map(([k]) => k));
      if (!tmKey) failed.add("Ticketmaster");
      if (!sgId) failed.add("SeatGeek");
      const previous = await readJSON(outFile, { events: [] });
      const kept = previous.events.filter((e) => inWindow(e) && failed.has(e.src));
      collected.push(...kept);
      report["Kept from last run"] = kept.length;
    }

    const events = mergeEvents(collected.filter(inWindow));
    const wiki = await enrichWithWikipedia(events, path.join(root, "cache", "wiki.json"));
    for (const e of events) { delete e._wiki; if (e.dg) delete e.dg; }
    await writeFile(outFile, JSON.stringify({ city: city.id, updated: start, events }) + "\n");
    const withPrice = events.filter((e) => e.p).length;
    const withImg = events.filter((e) => e.img).length;
    const withDesc = events.filter((e) => e.d).length;
    status.cities[city.id] = { events: events.length, withPrice, withImg, withDesc, wikipedia: wiki.used, sources: report };
    console.log(`  → ${events.length} events written (${withPrice} priced, ${withImg} photos, ${withDesc} described, ${wiki.used} from Wikipedia)`);
  }

  await writeFile(path.join(outDir, "status.json"), JSON.stringify(status, null, 2) + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
