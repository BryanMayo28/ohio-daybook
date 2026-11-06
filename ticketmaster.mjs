// Ticketmaster Discovery API: concerts, pro & college sports, Broadway tours, comedy.
// Free key: https://developer.ticketmaster.com (5,000 calls/day, 5 per second).
import { getJSON, sleep } from "../lib/http.mjs";
import { makeEvent, timeFrom24h, zoneFor, cleanText } from "../lib/normalize.mjs";

const SKIP = /\b(parking|vip package|upgrade|hospitality|suite rental|season ticket|gift card|test event)\b/i;

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

export function mapTicketmasterEvent(raw, city, settings) {
  if (!raw?.dates?.start?.localDate) return null;
  if (raw.dates.status?.code === "cancelled" || raw.dates.status?.code === "postponed") return null;
  if (SKIP.test(raw.name || "")) return null;
  const venue = raw._embedded?.venues?.[0] || {};
  const cls = raw.classifications?.find((c) => c.primary) || raw.classifications?.[0] || {};
  const segment = cls.segment?.name;
  const genre = cls.genre?.name;
  const sub = cls.subGenre?.name;
  const useful = (x) => x && !/^(undefined|other|miscellaneous)$/i.test(x);
  const tags = [genre, sub].filter(useful);
  const { t, m } = raw.dates.start.timeTBA || raw.dates.start.noSpecificTime ? { t: "", m: -1 } : timeFrom24h(raw.dates.start.localTime);
  const endDate = raw.dates.end?.localDate;
  return makeEvent({
    s: raw.dates.start.localDate,
    e: endDate && endDate !== raw.dates.start.localDate ? endDate : undefined,
    t, m,
    n: raw.name,
    v: venue.name,
    a: venue.city?.name || "",
    z: zoneFor(city, settings, venue.city?.name, venue.location?.latitude, venue.location?.longitude),
    c: mapTicketmasterCategory(segment, genre),
    d: cleanText(raw.info || raw.description || "") || (tags.length ? [...new Set(tags)].join(" · ") : segment || ""),
    u: raw.url,
    src: "Ticketmaster",
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
