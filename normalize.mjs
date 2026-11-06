// Shared helpers that turn raw source records into the app's event shape:
// { s, e?, t, m, n, v, a, z, c, d, u?, src }
//   s/e  start/end date "YYYY-MM-DD" (e only for multi-day events)
//   t/m  time label ("7:30 PM") and minutes after midnight (-1 = no time)
//   n/v/a  name, venue, area (neighborhood or town)
//   z    zone: core | near | trip
//   c    category: music sports arts comedy family festival market food community
//   d    one-line description, u link, src source name

export const CATEGORIES = ["music", "sports", "arts", "comedy", "family", "festival", "market", "food", "community"];

/** "19:30:00" or "19:30" -> { t: "7:30 PM", m: 1170 }; missing -> { t: "", m: -1 } */
export function timeFrom24h(hhmm) {
  const match = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
  if (!match) return { t: "", m: -1 };
  const h = Number(match[1]);
  const min = Number(match[2]);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const t = `${h12}${min ? ":" + String(min).padStart(2, "0") : ""} ${h < 12 ? "AM" : "PM"}`;
  return { t, m: h * 60 + min };
}

/** Parse a label like "7:30 PM" or "Doors 7 PM" into minutes, or -1. */
export function minutesFromLabel(label) {
  const match = /(\d{1,2})(?::(\d\d))?\s*(AM|PM)/i.exec(label || "");
  if (!match) return -1;
  const h = (Number(match[1]) % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return h * 60 + Number(match[2] || 0);
}

export function milesBetween(lat1, lng1, lat2, lng2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

/** core if the venue is in the city itself, near within nearMiles, otherwise trip. */
export function zoneFor(city, settings, venueCity, lat, lng) {
  const inCore = venueCity && city.coreCities.some((c) => c.toLowerCase() === String(venueCity).trim().toLowerCase());
  if (inCore) return "core";
  const la = Number(lat);
  const ln = Number(lng);
  if (Number.isFinite(la) && Number.isFinite(ln) && (la || ln)) {
    return milesBetween(city.lat, city.lng, la, ln) <= settings.nearMiles ? "near" : "trip";
  }
  return "near";
}

const KEYWORDS = [
  ["comedy", /\b(comedy|comedian|stand-?up|improv|funny bone|hilarities)\b/i],
  ["sports", /\b(vs\.?|basketball|football|hockey|soccer|baseball|volleyball|wrestling|marathon|5k|10k|race|trot|game day)\b/i],
  ["market", /\b(market|bazaar|craft (show|fair)|flea|vendor|makers?|antique|swap)\b|christkindl|markt\b/i],
  ["festival", /\b(festival|fest|parade|celebration|tree lighting)\b/i],
  ["food", /\b(beer|brew|wine|bourbon|tasting|dinner|brunch|trivia|bingo|food truck|pizza)\b/i],
  ["music", /\b(concert|symphony|orchestra|jazz|band|tour|live music|dj|choir|opera)\b/i],
  ["arts", /\b(theatre|theater|musical|ballet|dance|gallery|exhibit|art|film|screening|museum)\b/i],
  ["family", /\b(kids|family|zoo|lights|santa|story ?time|children|circus)\b/i],
];

/** Best guess at a category from free text; falls back to "community". */
export function guessCategory(text) {
  for (const [cat, re] of KEYWORDS) if (re.test(text || "")) return cat;
  return "community";
}

export function cleanText(s, max = 160) {
  const text = String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentence = cut.lastIndexOf(". ");
  return (sentence > 60 ? cut.slice(0, sentence + 1) : cut.replace(/\s+\S*$/, "") + "…");
}

export function addDays(iso, n) {
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Today's date in the given IANA time zone, "YYYY-MM-DD". */
export function todayIn(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Convert a UTC instant to { date: "YYYY-MM-DD", time: "HH:MM" } in a time zone. */
export function localParts(instant, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(instant).map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function makeEvent(fields) {
  const ev = {
    s: fields.s,
    t: fields.t || "",
    m: Number.isFinite(fields.m) ? fields.m : -1,
    n: cleanText(fields.n, 120),
    v: cleanText(fields.v || "Venue to be announced", 100),
    a: cleanText(fields.a || "", 60),
    z: ["core", "near", "trip"].includes(fields.z) ? fields.z : "core",
    c: CATEGORIES.includes(fields.c) ? fields.c : "community",
    d: cleanText(fields.d || ""),
    src: fields.src || "",
  };
  if (fields.e && fields.e > fields.s) ev.e = fields.e;
  if (fields.u) ev.u = fields.u;
  return ev;
}

const slug = (s) => String(s || "").toLowerCase().replace(/\bthe\b/g, "").replace(/[^a-z0-9]+/g, "");

/**
 * Merge events from all sources: drop exact repeats, treat two events at the
 * same venue, date and start time as one, and fold same-day performances of the
 * same show into one row ("2 PM & 7:30 PM").
 */
export function mergeEvents(list) {
  const byName = new Map();
  const byVenueTime = new Map();
  const out = [];
  const richness = (e) => (e.u ? 2 : 0) + (e.d ? 1 : 0) + (e.a ? 1 : 0);

  for (const ev of list) {
    const nameKey = `${slug(ev.n)}|${ev.s}|${slug(ev.v).slice(0, 14)}`;
    const vtKey = ev.m >= 0 ? `${slug(ev.v).slice(0, 14)}|${ev.s}|${ev.m}` : null;
    const existing = byName.get(nameKey) || (vtKey && byVenueTime.get(vtKey));
    if (!existing) {
      const copy = { ...ev };
      out.push(copy);
      byName.set(nameKey, copy);
      if (vtKey) byVenueTime.set(vtKey, copy);
      continue;
    }
    // Same show, different start time on the same day: list both times.
    if (ev.m >= 0 && existing.m >= 0 && ev.m !== existing.m && slug(ev.n) === slug(existing.n)) {
      const times = [...new Set([...existing.t.split(" & "), ev.t])]
        .map((t) => ({ t, m: minutesFromLabel(t) }))
        .sort((a, b) => a.m - b.m);
      existing.t = times.map((x) => x.t).join(" & ");
      existing.m = times[0].m;
    } else if (richness(ev) > richness(existing)) {
      for (const k of ["u", "d", "a"]) if (ev[k] && !existing[k]) existing[k] = ev[k];
    }
    if (ev.e && (!existing.e || ev.e > existing.e)) existing.e = ev.e;
    if (vtKey) byVenueTime.set(vtKey, existing);
  }
  return out.sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : a.m - b.m));
}
