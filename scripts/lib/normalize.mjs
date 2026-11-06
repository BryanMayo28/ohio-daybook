// Shared helpers that turn raw source records into the app's event shape:
//   s/e   start/end date "YYYY-MM-DD" (e only for multi-day events)
//   t/m   time label ("7:30 PM") and minutes after midnight (-1 = no time)
//   n/v/a name, venue, area (neighborhood or town)
//   z     zone: core | near | trip
//   c     category (see CATEGORIES)
//   d     description; dsrc names its source when it isn't the listing itself (e.g. "Wikipedia"), wu links to it
//   p/pm  price label ("Free", "$25", "From $25") and lowest price in dollars (0 = free); absent when unknown
//   img   cover image URL, u ticket/details link, src source name, lat/lng venue position when known

export const CATEGORIES = ["music", "sports", "arts", "comedy", "family", "festival", "market", "food", "outdoors", "community"];

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

const sameCity = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/** core if the venue is in the city itself, near within nearMiles, otherwise trip. */
export function zoneFor(city, settings, venueCity, lat, lng) {
  if (venueCity && city.coreCities.some((c) => sameCity(c, venueCity))) return "core";
  const la = Number(lat);
  const ln = Number(lng);
  if (Number.isFinite(la) && Number.isFinite(ln) && (la || ln)) {
    return milesBetween(city.lat, city.lng, la, ln) <= settings.nearMiles ? "near" : "trip";
  }
  return "near";
}

/** True when the venue sits in one of the OTHER cities the app has its own tab for. */
export function belongsToOtherCity(city, settings, venueCity) {
  if (!venueCity) return false;
  return settings.cities.some((other) => other.id !== city.id && other.coreCities.some((c) => sameCity(c, venueCity)));
}

const KEYWORDS = [
  ["comedy", /\b(comedy|comedian|stand-?up|improv|funny bone|hilarities)\b/i],
  ["sports", /\b(vs\.?|basketball|football|hockey|soccer|baseball|volleyball|wrestling|marathon|5k|10k|race|trot|game day)\b/i],
  ["market", /\b(market|bazaar|craft (show|fair)|flea|vendor|makers?|antique|swap)\b|christkindl|markt\b/i],
  ["outdoors", /\b(hike|hiking|trail|nature|birding|bird walk|naturalist|paddle|kayak|campfire|stargaz|wildlife|forest|prairie)\b/i],
  ["festival", /\b(festival|fest|parade|celebration|tree lighting)\b/i],
  ["food", /\b(beer|brew|wine|bourbon|tasting|dinner|brunch|trivia|bingo|food truck|pizza|cocktail)\b/i],
  ["music", /\b(concert|symphony|orchestra|jazz|band|tour|live music|dj|choir|opera|recital)\b/i],
  ["arts", /\b(theatre|theater|musical|ballet|dance|gallery|exhibit|exhibition|art|film|screening|museum)\b/i],
  ["family", /\b(kids|family|zoo|lights|santa|story ?time|children|circus|toddler)\b/i],
];

/** Best guess at a category from free text; falls back to "community". */
export function guessCategory(text) {
  for (const [cat, re] of KEYWORDS) if (re.test(text || "")) return cat;
  return "community";
}

const ENTITIES = { "&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#039;": "'", "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”", "&ndash;": "–", "&mdash;": "—", "&hellip;": "…", "&#8217;": "’", "&#8211;": "–", "&#8212;": "—" };

export function cleanText(s, max = 160) {
  const text = String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[#a-z0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentence = cut.lastIndexOf(". ");
  return sentence > max * 0.45 ? cut.slice(0, sentence + 1) : cut.replace(/\s+\S*$/, "") + "…";
}

/** Text that is venue policy, not a description of the event. */
export function isPolicyText(s) {
  const text = String(s || "");
  if (!text) return true;
  const hits = (text.match(/\b(bag|bags|policy|doors open|ticket delivery|delayed|prohibited|parking|ada|refund|resale|limit|clear bag|id required|all ages|21\+|18\+|smoking|camera|re-?entry|mobile tickets?|will call|box office)\b/gi) || []).length;
  return hits >= 2 || (hits >= 1 && text.length < 90);
}

/** "From $25" style label from a numeric range. */
export function priceLabel(min, max) {
  if (min == null || !Number.isFinite(min)) return null;
  const fmt = (n) => "$" + (n % 1 && n < 20 ? n.toFixed(2) : Math.round(n));
  if (min === 0 && (!max || max === 0)) return { p: "Free", pm: 0 };
  if (max != null && Math.round(max) === Math.round(min)) return { p: fmt(min), pm: min };
  return { p: "From " + fmt(min), pm: min };
}

/** Find a price in free text: "Free", "$8", "$20–$30 per car". */
export function priceFromText(text) {
  const t = String(text || "");
  if (/\b(free (admission|entry|event|and open|to (attend|the public|enter|wander|all|join|participate))|admission is free|is free|free!|free\.|free,|^free\b|free for all|no cost)/i.test(t) && !/\$\s?\d/.test(t)) {
    return { p: "Free", pm: 0 };
  }
  const amounts = [...t.matchAll(/\$\s?(\d{1,4}(?:\.\d{2})?)/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n < 5000);
  if (!amounts.length) return null;
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return priceLabel(min, max);
}

export function addDays(iso, n) {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
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

/** Strip ticketing noise from names: "(Touring)", " - Columbus", " - Columbus, OH - 11.06.26". */
export function cleanName(name) {
  return String(name || "")
    .replace(/\s*[-–|@]\s*[A-Z][a-z]+,?\s*(OH|Ohio)\b.*$/i, "")
    .replace(/\s*\((touring|tour|the musical)\)/gi, "")
    .replace(/\s+-\s+(Columbus|Cleveland|Cincinnati|Dayton|Akron|Toledo)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function makeEvent(fields) {
  const ev = {
    s: fields.s,
    t: fields.t || "",
    m: Number.isFinite(fields.m) ? fields.m : -1,
    n: cleanText(cleanName(fields.n), 120),
    v: cleanText(fields.v || "Venue to be announced", 100),
    a: cleanText(fields.a || "", 60),
    z: ["core", "near", "trip"].includes(fields.z) ? fields.z : "core",
    c: CATEGORIES.includes(fields.c) ? fields.c : "community",
    d: cleanText(fields.d || "", 480),
    src: fields.src || "",
  };
  if (fields.e && fields.e > fields.s) ev.e = fields.e;
  if (fields.u && /^https?:\/\//.test(fields.u)) ev.u = fields.u;
  if (fields.img && /^https:\/\//.test(fields.img)) ev.img = fields.img;
  if (fields.p) { ev.p = fields.p; ev.pm = fields.pm; }
  if (fields.dsrc) { ev.dsrc = fields.dsrc; if (fields.wu) ev.wu = fields.wu; }
  if (fields.dg) ev.dg = 1; // description is a generic fallback; any real one replaces it
  if (Number.isFinite(Number(fields.lat)) && Number(fields.lat)) { ev.lat = Math.round(Number(fields.lat) * 1e4) / 1e4; ev.lng = Math.round(Number(fields.lng) * 1e4) / 1e4; }
  if (fields._wiki) ev._wiki = fields._wiki;
  return ev;
}

// ---- Duplicate detection ---------------------------------------------------

const STOP = new Set(["the", "a", "an", "and", "of", "at", "vs", "v", "in", "w", "with", "presents", "live", "tour", "touring", "columbus", "cleveland", "cincinnati", "dayton", "akron", "toledo", "ohio", "oh", "show", "concert", "featuring", "feat", "ft"]);
const tokens = (s) => new Set(String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length > 1 && !STOP.has(w)));
const venueKey = (s) => [...tokens(String(s || "").split(/[-–,(]/)[0])].slice(0, 2).join(" ");

function similarNames(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return false;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size) >= 0.75 || shared / Math.max(A.size, B.size) >= 0.6;
}

const SOURCE_RANK = { Curated: 0, Ticketmaster: 1 };
const rank = (e) => SOURCE_RANK[e.src] ?? 2;

function absorb(keep, other) {
  for (const k of ["u", "img", "a", "lat", "lng"]) if (other[k] != null && keep[k] == null) keep[k] = other[k];
  if (other.p && !keep.p) { keep.p = other.p; keep.pm = other.pm; }
  const better = other.d && (!keep.d || keep.dg) && !other.dg ? true : other.d && !keep.d;
  if (better) { keep.d = other.d; delete keep.dg; if (other.dsrc) { keep.dsrc = other.dsrc; keep.wu = other.wu; } else { delete keep.dsrc; delete keep.wu; } }
  if (other._wiki && !keep._wiki) keep._wiki = other._wiki;
  if (other.e && (!keep.e || other.e > keep.e)) keep.e = other.e;
  if (keep.c === "community" && other.c !== "community") keep.c = other.c;
}

/**
 * Merge events from every source. Two listings are the same event when they
 * share a date, a venue and a similar name, or a venue and start time. Same
 * show at different times that day becomes one row: "2 PM & 7:30 PM".
 */
export function mergeEvents(list) {
  const sorted = [...list].sort((a, b) => rank(a) - rank(b));
  const byDay = new Map();
  const out = [];
  for (const ev of sorted) {
    const day = byDay.get(ev.s) || [];
    const vk = venueKey(ev.v);
    const match = day.find((x) => {
      const sameVenue = vk && venueKey(x.v) === vk;
      const nameMatch = similarNames(x.n, ev.n);
      if (nameMatch && (sameVenue || x.n.toLowerCase() === ev.n.toLowerCase())) return true;
      return sameVenue && ev.m >= 0 && x.m >= 0 && Math.abs(ev.m - x.m) <= 15 && nameMatch;
    });
    if (!match) {
      const copy = { ...ev, _times: ev.m >= 0 ? [{ t: ev.t, m: ev.m }] : [] };
      day.push(copy); byDay.set(ev.s, day); out.push(copy);
      continue;
    }
    absorb(match, ev);
    // A different start time more than 45 minutes away is another performance the same day.
    if (ev.m >= 0 && !match._times.some((x) => Math.abs(x.m - ev.m) <= 45)) match._times.push({ t: ev.t, m: ev.m });
    if (match.m < 0 && ev.m >= 0) { match.m = ev.m; match.t = ev.t; }
  }
  for (const e of out) {
    if (e._times.length > 1) {
      e._times.sort((a, b) => a.m - b.m);
      e.t = e._times.map((x) => x.t).join(" & ");
      e.m = e._times[0].m;
    }
    delete e._times;
  }
  return out.sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : a.m - b.m));
}
