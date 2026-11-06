// WordPress sites running "The Events Calendar" plugin publish a JSON API at
// /wp-json/tribe/events/v1/events with prices, photos and full descriptions.
// If the API is switched off, fall back to the same site's iCal export.
import { getJSON, sleep } from "../lib/http.mjs";
import { makeEvent, timeFrom24h, guessCategory, cleanText, priceFromText, priceLabel, zoneFor } from "../lib/normalize.mjs";
import { fetchICal, MEETING } from "./ical.mjs";

export function mapTribeEvent(raw, city, settings, feed) {
  if (!raw?.start_date || !raw.title) return null;
  const name = cleanText(raw.title, 140).replace(/^FREE\s+/i, "");
  if (feed.skipMeetings && MEETING.test(name)) return null;
  if (/\b(cancell?ed|postponed)\b/i.test(name)) return null;
  const [sDate, sTime] = raw.start_date.split(" ");
  const [eDate] = (raw.end_date || raw.start_date).split(" ");
  const { t, m } = raw.all_day ? { t: "", m: -1 } : timeFrom24h(sTime);
  const excerpt = cleanText(raw.excerpt, 480);
  const description = excerpt.length > 60 ? excerpt : cleanText(raw.description, 480) || excerpt;
  const venue = raw.venue && !Array.isArray(raw.venue) ? raw.venue : {};
  const values = (raw.cost_details?.values || []).map(Number).filter((n) => Number.isFinite(n));
  let price = null;
  if (/free/i.test(raw.cost || "")) price = { p: "Free", pm: 0 };
  else if (values.length) price = priceLabel(Math.min(...values), Math.max(...values));
  else price = priceFromText(`${raw.cost || ""} ${name} ${description}`);
  const cats = (raw.categories || []).map((c) => c.name).join(" ");
  const img = raw.image && raw.image.url ? (raw.image.sizes?.large?.url || raw.image.url) : undefined;
  return makeEvent({
    s: sDate,
    e: eDate > sDate ? eDate : undefined,
    t, m,
    n: name,
    v: cleanText(venue.venue, 100) || feed.venue || feed.name,
    a: feed.area || venue.city || city.name,
    z: feed.zone || zoneFor(city, settings, venue.city, venue.geo_lat, venue.geo_lng),
    lat: venue.geo_lat, lng: venue.geo_lng,
    c: feed.category || guessCategory(`${cats} ${name} ${description}`),
    d: description,
    p: price?.p, pm: price?.pm,
    img,
    u: raw.url,
    src: feed.name,
  });
}

export async function fetchTribe(city, settings, feed, { start, end, timeZone }) {
  const origin = new URL(feed.site).origin;
  try {
    const events = [];
    for (let page = 1; page <= 8; page++) {
      const url = new URL(origin + "/wp-json/tribe/events/v1/events");
      url.search = new URLSearchParams({ start_date: `${start} 00:00:00`, end_date: `${end} 23:59:59`, per_page: "50", page: String(page) });
      const body = await getJSON(url, { retries: 1 });
      for (const raw of body.events || []) {
        const ev = mapTribeEvent(raw, city, settings, feed);
        if (ev) events.push(ev);
      }
      if (!body.next_rest_url || page >= (body.total_pages || 1)) break;
      await sleep(200);
    }
    return events;
  } catch (err) {
    // API disabled or blocked: the iCal export has less detail but usually works.
    const ics = feed.ics || feed.site.replace(/\/?$/, "/") + "?ical=1";
    return fetchICal(city, { ...feed, ics }, { start, end, timeZone });
  }
}
