// Public iCalendar (.ics) feeds: city, downtown-district and venue calendars.
// Many WordPress event sites ("The Events Calendar" plugin) export one at  <events page>?ical=1
import { getText } from "../lib/http.mjs";
import { makeEvent, timeFrom24h, guessCategory, localParts, addDays, cleanText } from "../lib/normalize.mjs";

const unescape = (v) => v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1");

/** Minimal RFC 5545 reader: returns VEVENTs as { NAME: { value, params } } maps. */
export function parseICS(text) {
  const lines = String(text).replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events = [];
  let current = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { current = {}; continue; }
    if (line === "END:VEVENT") { if (current) events.push(current); current = null; continue; }
    if (!current) continue;
    // The value starts at the first colon that is not inside a quoted parameter.
    let inQuote = false, split = -1;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') inQuote = !inQuote;
      else if (line[i] === ":" && !inQuote) { split = i; break; }
    }
    if (split < 0) continue;
    const [name, ...paramParts] = line.slice(0, split).split(";");
    const params = Object.fromEntries(paramParts.map((p) => { const [k, ...v] = p.split("="); return [k.toUpperCase(), v.join("=").replace(/"/g, "")]; }));
    current[name.toUpperCase()] = { value: unescape(line.slice(split + 1)), params };
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
  // TZID or floating time: Ohio feeds publish Eastern local time, so take it as is.
  return { date, time: `${m[4]}:${m[5]}`, allDay: false };
}

export function mapICSEvent(vevent, city, feed, timeZone) {
  const start = icsWhen(vevent.DTSTART, timeZone);
  if (!start || !vevent.SUMMARY) return null;
  if (/^cancel/i.test(vevent.STATUS?.value || "")) return null;
  let endDate;
  const end = icsWhen(vevent.DTEND, timeZone);
  if (end) {
    endDate = end.allDay ? addDays(end.date, -1) : end.date; // all-day DTEND is exclusive
    // A timed event ending shortly after midnight still belongs to its start day.
    if (!end.allDay && endDate === addDays(start.date, 1) && end.time < "06:00") endDate = start.date;
  }
  const { t, m } = start.allDay ? { t: "", m: -1 } : timeFrom24h(start.time);
  const name = vevent.SUMMARY.value;
  const description = vevent.DESCRIPTION?.value || "";
  const location = vevent.LOCATION?.value || "";
  return makeEvent({
    s: start.date,
    e: endDate && endDate > start.date ? endDate : undefined,
    t, m,
    n: name,
    v: location.split(",")[0] || feed.name,
    a: feed.area || city.name,
    z: feed.zone || "core",
    c: feed.category || guessCategory(`${name} ${description}`),
    d: cleanText(description),
    u: vevent.URL?.value,
    src: feed.name,
  });
}

export async function fetchICal(city, feed, { start, end, timeZone }) {
  const text = await getText(feed.url, { headers: { Accept: "text/calendar, */*" } });
  if (!/BEGIN:VCALENDAR/.test(text)) throw new Error("response is not an iCalendar feed");
  return parseICS(text)
    .map((v) => mapICSEvent(v, city, feed, timeZone))
    .filter((e) => e && (e.e || e.s) >= start && e.s <= end);
}
