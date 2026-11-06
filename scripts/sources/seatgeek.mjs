// SeatGeek Platform API: fills gaps in Ticketmaster (minor-league sports, smaller venues).
// Free client id: https://seatgeek.com/account/develop
// The free tier returns no prices, images or descriptions, so those come from
// a matching Ticketmaster listing or Wikipedia when available.
import { getJSON, sleep } from "../lib/http.mjs";
import { makeEvent, timeFrom24h, zoneFor, belongsToOtherCity } from "../lib/normalize.mjs";

const TYPE_TO_CATEGORY = [
  [/comedy/, "comedy"],
  [/concert|music|classical|jazz|opera|band/, "music"],
  [/theater|theatre|broadway|dance|ballet|cirque|film/, "arts"],
  [/family|circus|kids|disney/, "family"],
  [/festival/, "festival"],
  [/sports|nba|nhl|nfl|mlb|mls|ncaa|minor_league|wrestling|hockey|football|basketball|baseball|soccer|racing|tennis|golf|boxing|mma|fighting|volleyball|rodeo/, "sports"],
];

export function mapSeatGeekCategory(type, taxonomies = []) {
  const text = [type, ...taxonomies.map((t) => t.name)].join(" ").toLowerCase();
  for (const [re, cat] of TYPE_TO_CATEGORY) if (re.test(text)) return cat;
  return "community";
}

export function mapSeatGeekEvent(raw, city, settings) {
  if (!raw?.datetime_local || raw.date_tbd) return null;
  const venue = raw.venue || {};
  if (belongsToOtherCity(city, settings, venue.city)) return null;
  if (/\bparking\b/i.test(raw.title || "")) return null;
  const [date, time] = raw.datetime_local.split("T");
  const { t, m } = raw.time_tbd ? { t: "", m: -1 } : timeFrom24h(time);
  const cat = mapSeatGeekCategory(raw.type, raw.taxonomies);
  const performer = (raw.performers || []).find((p) => p.primary) || raw.performers?.[0];
  const lowest = raw.stats?.lowest_price;
  return makeEvent({
    s: date,
    t, m,
    n: raw.short_title || raw.title,
    v: venue.name,
    a: venue.city || "",
    z: zoneFor(city, settings, venue.city, venue.location?.lat, venue.location?.lon),
    lat: venue.location?.lat, lng: venue.location?.lon,
    c: cat,
    d: raw.description || "",
    p: lowest ? "From $" + Math.round(lowest) : undefined, pm: lowest || undefined,
    img: performer?.image || undefined,
    u: raw.url,
    src: "SeatGeek",
    _wiki: performer && cat !== "sports" ? { name: performer.name, kind: cat } : undefined,
  });
}

export async function fetchSeatGeek(city, settings, { clientId, start, end }) {
  const events = [];
  for (let page = 1; page <= 10; page++) {
    const url = new URL("https://api.seatgeek.com/2/events");
    url.search = new URLSearchParams({
      client_id: clientId,
      lat: String(city.lat),
      lon: String(city.lng),
      range: `${settings.radiusMiles}mi`,
      "datetime_local.gte": `${start}T00:00:00`,
      "datetime_local.lte": `${end}T23:59:59`,
      per_page: "100",
      page: String(page),
      sort: "datetime_local.asc",
    });
    const body = await getJSON(url);
    for (const raw of body.events || []) {
      const ev = mapSeatGeekEvent(raw, city, settings);
      if (ev) events.push(ev);
    }
    const total = body.meta?.total ?? 0;
    if (page * 100 >= total) break;
    await sleep(250);
  }
  return events;
}
