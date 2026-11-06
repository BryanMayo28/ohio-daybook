// Ticketmaster Discovery API: concerts, pro & college sports, Broadway tours, comedy.
// Free key: https://developer.ticketmaster.com (5,000 calls/day, 5 per second).
import { getJSON, sleep } from "../lib/http.mjs";
import { makeEvent, timeFrom24h, zoneFor, belongsToOtherCity, cleanText, isPolicyText, priceLabel, priceFromText } from "../lib/normalize.mjs";

const SKIP = /\b(parking|vip package|upgrade|hospitality|suite rental|season ticket|gift card|test event|premium seating|club access|add-on|meet & greet only)\b/i;

export function mapTicketmasterCategory(segment, genre) {
  const g = (genre || "").toLowerCase();
  if (g.includes("comedy")) return "comedy";
  switch (segment) {
    case "Music": return "music";
    case "Sports": return "sports";
    case "Arts & Theatre": return "arts";
    case "Film": return "arts";
    case "Miscellaneous":
      if (g.includes("family") || g.includes("children")) return "family";
      if (g.includes("fair") || g.includes("festival")) return "festival";
      if (g.includes("food") || g.includes("drink")) return "food";
      return "community";
    default:
      return "community";
  }
}

/** Largest real (non-stock) 16:9 image up to ~1300px wide. */
export function pickImage(images = []) {
  const real = images.filter((i) => !i.fallback && i.url?.startsWith("https://"));
  const wide = real.filter((i) => i.ratio === "16_9" && i.width >= 600 && i.width <= 1300);
  const pool = wide.length ? wide : real.filter((i) => i.ratio === "16_9" && i.width >= 600);
  pool.sort((a, b) => Math.abs(a.width - 1024) - Math.abs(b.width - 1024));
  return pool[0]?.url;
}

const useful = (x) => x && !/^(undefined|other|miscellaneous|music|sports|arts & theatre|group)$/i.test(x);

function fallbackDescription(segment, genre, sub, venue) {
  const kind = [sub, genre].filter(useful)[0];
  const noun = segment === "Music" ? "concert" : segment === "Sports" ? "game" : segment === "Film" ? "screening" : "show";
  if (!kind) return "";
  return `${kind} ${noun} at ${venue}.`.replace(/^./, (c) => c.toUpperCase());
}

export function mapTicketmasterEvent(raw, city, settings) {
  if (!raw?.dates?.start?.localDate) return null;
  if (["cancelled", "postponed", "rescheduled"].includes(raw.dates.status?.code)) return null;
  if (SKIP.test(raw.name || "")) return null;
  const venue = raw._embedded?.venues?.[0] || {};
  if (belongsToOtherCity(city, settings, venue.city?.name)) return null;
  const cls = raw.classifications?.find((c) => c.primary) || raw.classifications?.[0] || {};
  const segment = cls.segment?.name;
  const genre = cls.genre?.name;
  const sub = cls.subGenre?.name;
  const { t, m } = raw.dates.start.timeTBA || raw.dates.start.noSpecificTime ? { t: "", m: -1 } : timeFrom24h(raw.dates.start.localTime);
  const endDate = raw.dates.end?.localDate;

  const blurb = [raw.description, raw.info].map((x) => cleanText(x, 480)).find((x) => x && !isPolicyText(x)) || "";
  const generic = blurb ? "" : fallbackDescription(segment, genre, sub, venue.name || "the venue");

  const ranges = (raw.priceRanges || []).filter((r) => r.currency === "USD" && Number.isFinite(r.min));
  const price = ranges.length
    ? priceLabel(Math.min(...ranges.map((r) => r.min)), Math.max(...ranges.map((r) => r.max ?? r.min)))
    : priceFromText(blurb);

  const attraction = (raw._embedded?.attractions || [])[0];
  const wiki = attraction && segment !== "Sports"
    ? { name: attraction.name, url: attraction.externalLinks?.wiki?.[0]?.url, kind: segment }
    : undefined;

  return makeEvent({
    s: raw.dates.start.localDate,
    e: endDate && endDate !== raw.dates.start.localDate ? endDate : undefined,
    t, m,
    n: raw.name,
    v: venue.name,
    a: venue.city?.name || "",
    z: zoneFor(city, settings, venue.city?.name, venue.location?.latitude, venue.location?.longitude),
    lat: venue.location?.latitude, lng: venue.location?.longitude,
    c: mapTicketmasterCategory(segment, genre),
    d: blurb || generic,
    dg: !blurb,
    p: price?.p, pm: price?.pm,
    img: pickImage(raw.images),
    u: raw.url,
    src: "Ticketmaster",
    _wiki: wiki,
  });
}

export async function fetchTicketmaster(city, settings, { apiKey, start, end }) {
  const events = [];
  for (let page = 0; page < 5; page++) {
    const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
    url.search = new URLSearchParams({
      apikey: apiKey,
      latlong: `${city.lat},${city.lng}`,
      radius: String(settings.radiusMiles),
      unit: "miles",
      startDateTime: `${start}T00:00:00Z`,
      endDateTime: `${end}T23:59:59Z`,
      size: "200",
      page: String(page),
      sort: "date,asc",
      locale: "*",
    });
    const body = await getJSON(url);
    for (const raw of body._embedded?.events || []) {
      const ev = mapTicketmasterEvent(raw, city, settings);
      if (ev) events.push(ev);
    }
    const totalPages = body.page?.totalPages ?? 0;
    if (page + 1 >= totalPages) break;
    await sleep(300); // stay under 5 requests per second
  }
  return events;
}
