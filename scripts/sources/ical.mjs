// Public iCalendar (.ics) feeds: city, park-district, venue and college-athletics calendars.
import { getText } from "../lib/http.mjs";
import { makeEvent, timeFrom24h, guessCategory, localParts, addDays, cleanText, priceFromText } from "../lib/normalize.mjs";

const unescape = (v) => v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1");
export const MEETING = /\b(council|commission|committee|board of|board meeting|meeting|hearing|work session|closed|court|holiday|office closed|trash|recycling|leaf collection|budget)\b/i;

/** Minimal RFC 5545 reader: returns VEVENTs as { NAME: { value, params } } maps. */
export function parseICS(text) {
  const lines = String(text).replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events = [];
  let current = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { current = {}; continue; }
    if (line === "END:VEVENT") { if (current) events.push(current); current = null; continue; }
    if (!current) continue;
    let inQuote = false, split = -1;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') inQuote = !inQuote;
      else if (line[i] === ":" && !inQuote) { split = i; break; }
    }
    if (split < 0) continue;
    const [name, ...paramParts] = line.slice(0, split).split(";");
    const params = Object.fromEntries(paramParts.map((p) => { const [k, ...v] = p.split("="); return [k.toUpperCase(), v.join("=").replace(/"/g, "")]; }));
    const key = name.toUpperCase();
    if (!(key in current)) current[key] = { value: unescape(line.slice(split + 1)), params };
  }
  return events;
}

/** ICS date-time -> { date, time|null } in the target time zone. */
export function icsWhen(prop, timeZone) {
  if (!prop) return null;
  const v = prop.value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[4] || prop.params.VALUE === "DATE") return { date, time: null, allDay: true };
  if (m[7]) {
    return { ...localParts(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))), timeZone), allDay: false };
  }
  return { date, time: `${m[4]}:${m[5]}`, allDay: false };
}

export function mapICSEvent(vevent, city, feed, timeZone) {
  const start = icsWhen(vevent.DTSTART, timeZone);
  if (!start || !vevent.SUMMARY) return null;
  if (/^cancel/i.test(vevent.STATUS?.value || "")) return null;
  let name = vevent.SUMMARY.value.replace(/^\[[A-Z]\]\s*/, "").trim();
  if (/\b(cancell?ed|postponed)\b/i.test(name)) return null;
  if (feed.skipMeetings && MEETING.test(name)) return null;
  const location = vevent.LOCATION?.value || "";
  if (feed.homeOnly) {
    // College athletics feeds list road games too; keep only games in the home town.
    if (!new RegExp(feed.homeOnly, "i").test(location)) return null;
  }
  let endDate;
  const end = icsWhen(vevent.DTEND, timeZone);
  if (end) {
    endDate = end.allDay ? addDays(end.date, -1) : end.date; // all-day DTEND is exclusive
    if (!end.allDay && endDate === addDays(start.date, 1) && end.time < "06:00") endDate = start.date;
  }
  const { t, m } = start.allDay ? { t: "", m: -1 } : timeFrom24h(start.time);
  const description = cleanText(vevent.DESCRIPTION?.value || "", 480);
  const price = priceFromText(`${name} ${description}`);
  let venue = (feed.venueFromLocation === false ? feed.venue : location.replace(/^[\s\-–]+/, "").split(",")[0].trim()) || feed.venue || feed.name;
  // Athletics feeds often give only "Columbus, Ohio" as the location.
  if (feed.homeOnly && new RegExp(`^${feed.homeOnly}$`, "i").test(venue)) venue = feed.venue || feed.name;
  const attach = vevent.ATTACH;
  const img = attach && (/^image\//.test(attach.params.FMTTYPE || "") || /\.(jpe?g|png|webp)(\?|$)/i.test(attach.value)) ? attach.value : undefined;
  return makeEvent({
    s: start.date,
    e: endDate && endDate > start.date ? endDate : undefined,
    t, m,
    n: name.replace(/^FREE\s+/i, ""),
    v: venue,
    a: feed.area || city.name,
    z: feed.zone || "core",
    c: feed.category || guessCategory(`${name} ${description}`),
    d: description,
    p: price?.p, pm: price?.pm,
    img,
    u: vevent.URL?.value,
    src: feed.name,
  });
}

export async function fetchICal(city, feed, { start, end, timeZone }) {
  const text = await getText(feed.ics || feed.url, { headers: { Accept: "text/calendar, */*" } });
  if (!/BEGIN:VCALENDAR/.test(text)) throw new Error("response is not an iCalendar feed");
  return parseICS(text)
    .map((v) => mapICSEvent(v, city, feed, timeZone))
    .filter((e) => e && (e.e || e.s) >= start && e.s <= end);
}
