// Ohio Daybook front end. Reads data/<city>.json written by scripts/refresh.mjs.
const CITIES = [
  { id: "columbus", name: "Columbus", lat: 39.9612, lng: -82.9988, zones: { core: "Columbus", near: "Suburbs", trip: "Day trips" } },
  { id: "cleveland", name: "Cleveland", lat: 41.4993, lng: -81.6944, zones: { core: "Cleveland", near: "Suburbs", trip: "Day trips" } },
  { id: "cincinnati", name: "Cincinnati", lat: 39.1031, lng: -84.512, zones: { core: "Cincinnati", near: "Suburbs & NKY", trip: "Day trips" } },
  { id: "dayton", name: "Dayton", lat: 39.7589, lng: -84.1916, zones: { core: "Dayton", near: "Suburbs", trip: "Day trips" } },
  { id: "akron", name: "Akron", lat: 41.0814, lng: -81.519, zones: { core: "Akron", near: "Kent & suburbs", trip: "Day trips" } },
  { id: "toledo", name: "Toledo", lat: 41.6528, lng: -83.5379, zones: { core: "Toledo", near: "Suburbs", trip: "Day trips" } },
];
const CATS = { music: "Music", sports: "Sports", arts: "Arts & theater", comedy: "Comedy", family: "Family", festival: "Festivals", market: "Markets", food: "Food & drink", outdoors: "Outdoors", community: "Community" };
const ICON = {
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  sports: '<ellipse cx="12" cy="12" rx="9" ry="6" transform="rotate(-35 12 12)"/><path d="M9.5 14.5l5-5M10.5 11l2.5 2.5M12 9.5l2.5 2.5"/>',
  arts: '<path d="M4 4h16v7a8 8 0 0 1-16 0z"/><path d="M9 9h.01M15 9h.01M9 14c1.5 1.5 4.5 1.5 6 0"/>',
  comedy: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
  family: '<path d="M12 3L3 12h18z"/><path d="M5 12v8h14v-8M10 20v-4h4v4M12 3V1"/>',
  festival: '<path d="M5 22V3"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
  market: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  food: '<path d="M3 8h14v5a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6z"/><path d="M17 10h2a2 2 0 0 1 0 4h-2M7 2v3M11 2v3"/>',
  outdoors: '<path d="M12 2l6 9h-3l4 6H5l4-6H6z"/><path d="M12 17v5"/>',
  community: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5A5 5 0 0 1 21 19"/>',
};
const UI = {
  heart: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M12 13v5M9.5 15.5h5"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  partly: '<path d="M12 4v1M5.6 6.6l.7.7M4 13h1"/><path d="M8.5 11a4 4 0 0 1 7.4-1.6"/><path d="M8 20h9a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.5 1.5A2.8 2.8 0 0 0 8 20z"/>',
  cloud: '<path d="M7 19h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.5A3.3 3.3 0 0 0 7 19z"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  snow: '<path d="M7 14h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.5A3.3 3.3 0 0 0 7 14z"/><path d="M8 18h.01M12 20h.01M16 18h.01M10 22h.01M14 22h.01"/>',
  storm: '<path d="M7 15h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M12 15l-2 4h3l-2 4"/>',
};
const svg = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const LONG_RUN = 6;
const WINDOW = 28;

const $ = (id) => document.getElementById(id);
const store = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const spanDays = (e) => (e.e ? Math.round((parse(e.e) - parse(e.s)) / 864e5) : 0);
const fmtShort = (s) => parse(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtLong = (s) => parse(s).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const idOf = (e) => { let h = 5381; for (const ch of `${e.s}|${e.n}|${e.v}`) h = ((h << 5) + h + ch.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
const onDay = (e, day) => e.s <= day && (e.e || e.s) >= day;

const today = new Date(); today.setHours(0, 0, 0, 0);
const TODAY = iso(today);
const DAYS = [];
for (let i = 0; i < WINDOW; i++) { const d = new Date(today); d.setDate(d.getDate() + i); DAYS.push(iso(d)); }
const WEEKEND = (() => {
  const dow = today.getDay(); // 0 Sun … 6 Sat
  const startOffset = dow === 0 ? 0 : dow === 6 ? 0 : 5 - dow; // Fri, or today if it's already the weekend
  const out = [];
  for (let i = startOffset; i < startOffset + 3 && i < WINDOW; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    if ([5, 6, 0].includes(d.getDay())) out.push(iso(d));
    if (d.getDay() === 0) break;
  }
  return out;
})();

const data = {};
const updated = {};
const weather = {};
let saved = store.get("saved", {});
let home = store.get("home", null);
const fromHash = location.hash.slice(1);
const state = {
  city: CITIES.some((c) => c.id === fromHash) ? fromHash : CITIES.some((c) => c.id === store.get("city")) ? store.get("city") : "columbus",
  view: "day", day: TODAY, zone: "all", price: "any", cat: "all", q: "",
};
const expanded = new Set();
let calOpen = null;

/* ---------- helpers ---------- */
function milesTo(e) {
  if (!home || !Number.isFinite(e.lat)) return null;
  const toRad = (x) => (x * Math.PI) / 180;
  const a = Math.sin(toRad(e.lat - home.lat) / 2) ** 2 + Math.cos(toRad(home.lat)) * Math.cos(toRad(e.lat)) * Math.sin(toRad(e.lng - home.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a)) * 1.25; // rough driving distance
}
const distLabel = (mi) => (mi == null ? "" : mi < 1 ? "under 1 mi" : `${Math.round(mi)} mi`);
function priceOk(e) {
  if (state.price === "free") return e.pm === 0;
  if (state.price === "u25") return e.pm != null && e.pm < 25;
  return true;
}
const cityObj = () => CITIES.find((c) => c.id === state.city);
const isSaved = (e) => !!saved[idOf(e)];
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 2200);
}
function findEvent(id) {
  for (const list of Object.values(data)) for (const e of list) if (idOf(e) === id) return e;
  return saved[id] || null;
}

/* ---------- calendar export ---------- */
function eventTimes(e) {
  const pad = (n) => String(n).padStart(2, "0");
  const date = e.s.replace(/-/g, "");
  if (e.m < 0) {
    const endDay = iso(new Date(parse(e.e || e.s).getTime() + 864e5)).replace(/-/g, "");
    return { allDay: true, start: date, end: endDay };
  }
  const h = Math.floor(e.m / 60), mi = e.m % 60;
  const endM = e.m + 120;
  return { allDay: false, start: `${date}T${pad(h)}${pad(mi)}00`, end: `${date}T${pad(Math.floor(endM / 60) % 24)}${pad(endM % 60)}00` };
}
function icsFor(e) {
  const t = eventTimes(e);
  const clean = (s) => String(s || "").replace(/[\\,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ohio Daybook//EN", "BEGIN:VEVENT",
    `UID:${idOf(e)}@ohio-daybook`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    t.allDay ? `DTSTART;VALUE=DATE:${t.start}` : `DTSTART;TZID=America/New_York:${t.start}`,
    t.allDay ? `DTEND;VALUE=DATE:${t.end}` : `DTEND;TZID=America/New_York:${t.end}`,
    `SUMMARY:${clean(e.n)}`, `LOCATION:${clean([e.v, e.a].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${clean([e.d, e.u].filter(Boolean).join("\n\n"))}`, e.u ? `URL:${e.u}` : "", "END:VEVENT", "END:VCALENDAR"].filter(Boolean);
  return lines.join("\r\n");
}
function googleCalUrl(e) {
  const t = eventTimes(e);
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.n, dates: `${t.start}/${t.end}`, location: [e.v, e.a].filter(Boolean).join(", "), details: [e.d, e.u].filter(Boolean).join("\n\n") });
  if (!t.allDay) p.set("ctz", "America/New_York");
  return "https://calendar.google.com/calendar/render?" + p.toString();
}
function downloadIcs(e) {
  const blob = new Blob([icsFor(e)], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = e.n.replace(/[^\w\s-]/g, "").trim().slice(0, 60) + ".ics";
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function directionsUrl(e) {
  const dest = Number.isFinite(e.lat) ? `${e.lat},${e.lng}` : [e.v, e.a, cityObj().name, "OH"].filter(Boolean).join(", ");
  return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(dest);
}

/* ---------- rendering ---------- */
function renderCities() {
  $("cities").innerHTML = CITIES.map((c) => `<button type="button" class="tab" role="tab" id="tab-${c.id}" data-city="${c.id}" aria-selected="${c.id === state.city}">${esc(c.name)}</button>`).join("");
}

function wxIcon(code) {
  if (code == null) return "";
  if (code <= 1) return UI.sun;
  if (code <= 3) return UI.partly;
  if (code >= 95) return UI.storm;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return UI.snow;
  if (code >= 51) return UI.rain;
  return UI.cloud;
}
function wxBadge(day) {
  const w = weather[state.city]?.[day];
  if (!w) return '<span class="wx"></span>';
  return `<span class="wx" title="High ${w.hi}°F${w.pop != null ? `, ${w.pop}% chance of rain` : ""}">${svg(wxIcon(w.code))}${w.hi}°</span>`;
}

function renderDays() {
  const box = $("days");
  const keep = box.scrollLeft;
  const evs = data[state.city] || [];
  let html = "";
  if (WEEKEND.length) {
    const pressed = state.view === "weekend";
    html += `<button type="button" class="day wknd" data-view="weekend" aria-pressed="${pressed}"><i>THIS</i><b>Weekend</b><span class="wx"></span></button>`;
  }
  for (const day of DAYS) {
    const d = parse(day);
    const n = evs.filter((e) => onDay(e, day) && spanDays(e) <= LONG_RUN).length;
    const wd = day === TODAY ? "TODAY" : d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    const pressed = state.view === "day" && day === state.day;
    html += `<button type="button" class="day${n ? "" : " empty"}" id="day-${day}" data-day="${day}" aria-pressed="${pressed}" aria-label="${esc(d.toDateString())}, ${n} events"><i>${wd}</i><b>${d.getDate()}</b>${wxBadge(day)}</button>`;
  }
  box.innerHTML = html;
  box.scrollLeft = keep;
}

function chip(key, label, count, current, group, icon, cat) {
  return `<button type="button" class="chip" data-${group}="${key}" aria-pressed="${key === current}"${cat ? ` data-c="${cat}"` : ""}>${icon ? svg(icon) : ""}${esc(label)}${count != null ? `<em>${count}</em>` : ""}</button>`;
}

function card(e, city) {
  const id = idOf(e);
  const span = spanDays(e);
  const free = e.pm === 0;
  const priceTag = e.p ? `<span class="price${free ? " free" : ""}">${esc(e.p)}</span>` : "";
  const saveBtn = `<button type="button" class="save" data-save="${id}" aria-pressed="${isSaved(e)}" aria-label="${isSaved(e) ? "Remove from my plans" : "Save to my plans"}">${svg(UI.heart)}</button>`;
  const art = `<div class="tile">${svg(ICON[e.c] || ICON.community)}</div>`;
  const cover = e.img
    ? `<div class="cover" data-c="${e.c}"><img src="${esc(e.img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback="1">${saveBtn}${priceTag}</div>`
    : `<div class="cover art" data-c="${e.c}">${art}${saveBtn}${priceTag}</div>`;
  const when = span > 0 ? (span > LONG_RUN ? `Through ${fmtShort(e.e)}` : `${fmtShort(e.s)} – ${fmtShort(e.e)}`) + (e.t ? ` · ${e.t}` : "") : e.t || "All day";
  const dist = distLabel(milesTo(e));
  const where = `${esc(e.v)}${e.a && e.a !== e.v ? " · " + esc(e.a) : ""}${dist ? ` · <span class="dist">${dist}</span>` : ""}`;
  const isOpen = expanded.has(id);
  const longDesc = e.d && e.d.length > 220;
  const desc = e.d ? `<p class="desc${isOpen ? " open" : ""}">${esc(e.d)}</p>${longDesc ? `<button type="button" class="more" data-more="${id}">${isOpen ? "Show less" : "More"}</button>` : ""}` : "";
  const credit = e.dsrc === "Wikipedia" ? `<span class="credit">About the performer, from <a href="${esc(e.wu || "https://en.wikipedia.org")}" target="_blank" rel="noopener">Wikipedia</a></span>` : "";
  const zone = e.z !== "core" ? `<span class="zone">${esc(city.zones[e.z])}</span>` : "";
  const run = span > LONG_RUN ? `<span class="run">Ongoing</span>` : "";
  const ticket = e.u ? `<a class="go" href="${esc(e.u)}" target="_blank" rel="noopener">${/Ticketmaster|SeatGeek/.test(e.src) ? "Tickets" : "Details"} →</a>` : "";
  const cal = calOpen === id ? `<div class="cal-menu"><button type="button" class="btn" data-ics="${id}">${svg(UI.cal)}Apple / Outlook</button><a class="btn" href="${esc(googleCalUrl(e))}" target="_blank" rel="noopener">${svg(UI.cal)}Google Calendar</a></div>` : "";
  return `<article class="card" data-id="${id}">
    ${cover}
    <div class="body">
      <div class="when">${esc(when)}</div>
      <h3>${esc(e.n)}</h3>
      <div class="where">${where}</div>
      ${desc}${credit}
      <div class="foot">
        <span class="tag">${esc(CATS[e.c] || "Community")}${zone}${run}</span>
        <button type="button" class="icon-btn" data-cal="${id}" aria-label="Add to calendar" aria-expanded="${calOpen === id}">${svg(UI.cal)}</button>
        <button type="button" class="icon-btn" data-share="${id}" aria-label="Share">${svg(UI.share)}</button>
        <a class="icon-btn" href="${esc(directionsUrl(e))}" target="_blank" rel="noopener" aria-label="Directions">${svg(UI.pin)}</a>
        ${ticket}
      </div>
      ${cal}
    </div>
  </article>`;
}

function row(e) {
  const free = e.pm === 0;
  const span = spanDays(e);
  const sub = [span > LONG_RUN ? `Through ${fmtShort(e.e)}` : e.t, e.v, e.a].filter(Boolean).join(" · ");
  return `<div class="row" data-c="${e.c}"><span class="mini">${svg(ICON[e.c] || ICON.community)}</span><div class="txt"><b>${esc(e.n)}</b><span>${esc(sub)}</span></div>${e.p ? `<span class="rp${free ? " free" : ""}">${esc(e.p)}</span>` : ""}<button type="button" class="icon-btn" data-save="${idOf(e)}" aria-pressed="${isSaved(e)}" aria-label="Save">${svg(UI.heart)}</button></div>`;
}

function applyFilters(list, { useCat = true } = {}) {
  return list.filter((e) => (state.zone === "all" || e.z === state.zone) && priceOk(e) && (!useCat || state.cat === "all" || e.c === state.cat));
}

function renderFilters(pool) {
  const city = cityObj();
  const zoneCounts = (z) => pool.filter((e) => e.z === z && priceOk(e)).length;
  const priced = pool.filter((e) => state.zone === "all" || e.z === state.zone);
  let html = chip("all", "Everywhere", null, state.zone, "zone");
  for (const [k, label] of Object.entries(city.zones)) if (zoneCounts(k)) html += chip(k, label, null, state.zone, "zone");
  html += '<span class="sep" aria-hidden="true"></span>';
  html += chip("any", "Any price", null, state.price, "price");
  html += chip("free", "Free", priced.filter((e) => e.pm === 0).length, state.price, "price");
  html += chip("u25", "Under $25", priced.filter((e) => e.pm != null && e.pm < 25).length, state.price, "price");
  $("filters").innerHTML = html;
  const inZone = applyFilters(pool, { useCat: false });
  let cats = chip("all", "All types", inZone.length, state.cat, "cat");
  for (const [k, label] of Object.entries(CATS)) {
    const n = inZone.filter((e) => e.c === k).length;
    if (n) cats += chip(k, label, n, state.cat, "cat", ICON[k], k);
  }
  $("cats").innerHTML = cats;
}

function listHTML(events, city) {
  const main = events.filter((e) => spanDays(e) <= LONG_RUN).sort((a, b) => a.m - b.m);
  const running = events.filter((e) => spanDays(e) > LONG_RUN);
  let html = main.length ? `<div class="list">${main.map((e) => card(e, city)).join("")}</div>` : "";
  if (running.length) html += `<div class="group-h">Still running</div><div class="compact">${running.map(row).join("")}</div>`;
  return { html, main: main.length, running: running.length };
}

function render() {
  renderCities(); renderDays();
  const city = cityObj();
  const evs = data[state.city];
  const count = Object.keys(saved).length;
  $("savedCount").textContent = count ? String(count) : "Plans";
  $("savedBtn").classList.toggle("has", count > 0);
  $("homeLabel").textContent = home ? home.label : "Home";
  $("foot").innerHTML = `${esc(city.name)} listings updated ${updated[state.city] ? fmtShort(updated[state.city]) : "—"}. Sources: Ticketmaster, SeatGeek, city and venue calendars, Wikipedia and hand-picked local events. Weather by <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a>. Prices and times change; check before you go.`;

  if (state.view === "saved") return renderSaved();
  if (!evs) { $("filters").innerHTML = $("cats").innerHTML = $("out").innerHTML = ""; return; }

  if (state.q.trim()) return renderSearch(evs, city);

  if (state.view === "weekend") {
    const pool = evs.filter((e) => WEEKEND.some((d) => onDay(e, d)));
    renderFilters(pool);
    $("title").textContent = "This weekend";
    let html = "", total = 0;
    for (const day of WEEKEND) {
      const dayEvents = applyFilters(evs.filter((e) => onDay(e, day) && spanDays(e) <= LONG_RUN));
      if (!dayEvents.length) continue;
      total += dayEvents.length;
      html += `<div class="group-h">${esc(fmtLong(day))}</div><div class="list">${dayEvents.sort((a, b) => a.m - b.m).map((e) => card(e, city)).join("")}</div>`;
    }
    $("sub").textContent = `${total} events in ${city.name} and nearby, ${WEEKEND.map(fmtShort).join(" – ")}`;
    $("out").innerHTML = html || emptyNote(city);
    return;
  }

  const pool = evs.filter((e) => onDay(e, state.day));
  renderFilters(pool);
  const shown = applyFilters(pool);
  $("title").textContent = (state.day === TODAY ? "Today, " : "") + fmtLong(state.day);
  const { html, main, running } = listHTML(shown, city);
  const free = shown.filter((e) => e.pm === 0 && spanDays(e) <= LONG_RUN).length;
  $("sub").textContent = `${main} events in ${city.name} and nearby` + (free ? ` · ${free} free` : "") + (running ? ` · ${running} still running` : "");
  $("out").innerHTML = html || emptyNote(city);
  const sel = $(`day-${state.day}`), box = $("days");
  if (sel) { const left = sel.offsetLeft - box.offsetLeft; if (left < box.scrollLeft || left + sel.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = left - 12; }
}

function emptyNote(city) {
  const filtered = state.zone !== "all" || state.price !== "any" || state.cat !== "all";
  return `<div class="note"><strong>Nothing matches here yet</strong>${filtered ? "Try clearing a filter, or pick another day." : `No listings for ${esc(city.name)} on this day yet. Try a nearby date.`}</div>`;
}

function renderSearch(evs, city) {
  const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = evs.filter((e) => {
    const text = `${e.n} ${e.v} ${e.a} ${e.d} ${CATS[e.c]}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
  renderFilters(hits);
  const shown = applyFilters(hits).sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : a.m - b.m)).slice(0, 80);
  $("title").textContent = `“${state.q.trim()}”`;
  $("sub").textContent = `${shown.length} match${shown.length === 1 ? "" : "es"} in ${city.name} over the next 4 weeks`;
  let html = "", last = "";
  for (const e of shown) {
    if (e.s !== last) { if (last) html += "</div>"; html += `<div class="group-h">${esc(fmtLong(e.s < TODAY ? TODAY : e.s))}</div><div class="list">`; last = e.s; }
    html += card(e, city);
  }
  if (last) html += "</div>";
  $("out").innerHTML = html || `<div class="note"><strong>No matches</strong>Try a shorter word, a venue name or another city tab.</div>`;
}

function renderSaved() {
  const list = Object.values(saved).filter((e) => (e.e || e.s) >= TODAY).sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : a.m - b.m));
  $("filters").innerHTML = $("cats").innerHTML = "";
  $("title").textContent = "My plans";
  $("sub").textContent = list.length ? `${list.length} saved event${list.length === 1 ? "" : "s"}. They stay on this phone.` : "Tap the heart on any event to save it here.";
  let html = "", last = "";
  for (const e of list) {
    const city = CITIES.find((c) => c.id === e._city) || cityObj();
    if (e.s !== last) { if (last) html += "</div>"; html += `<div class="group-h">${esc(fmtLong(e.s < TODAY ? TODAY : e.s))}</div><div class="list">`; last = e.s; }
    html += card(e, city);
  }
  if (last) html += "</div>";
  $("out").innerHTML = html || `<div class="note"><strong>No plans yet</strong>Save events with the heart and they'll show up here with calendar, share and directions buttons.</div>`;
  // Drop plans that are over.
  let changed = false;
  for (const [k, e] of Object.entries(saved)) if ((e.e || e.s) < TODAY) { delete saved[k]; changed = true; }
  if (changed) store.set("saved", saved);
}

/* ---------- interactions ---------- */
document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("button, a");
  if (!t) return;
  const d = t.dataset;
  if (d.city) {
    Object.assign(state, { city: d.city, zone: "all", cat: "all", view: state.view === "saved" ? "day" : state.view });
    store.set("city", d.city); history.replaceState(null, "", `#${d.city}`); render(); loadWeather(); return;
  }
  if (d.day) { Object.assign(state, { day: d.day, view: "day", q: "" }); $("q").value = ""; render(); window.scrollTo({ top: 0 }); return; }
  if (d.view) { Object.assign(state, { view: d.view, q: "" }); $("q").value = ""; render(); window.scrollTo({ top: 0 }); return; }
  if (d.zone) { state.zone = d.zone; state.cat = "all"; render(); return; }
  if (d.price) { state.price = d.price; render(); return; }
  if (d.cat) { state.cat = d.cat; render(); return; }
  if (d.more) { expanded.has(d.more) ? expanded.delete(d.more) : expanded.add(d.more); render(); return; }
  if (d.save) {
    const e = findEvent(d.save);
    if (!e) return;
    if (saved[d.save]) { delete saved[d.save]; toast("Removed from your plans"); }
    else { saved[d.save] = { ...e, _city: state.city }; toast("Saved to your plans"); }
    store.set("saved", saved); render(); return;
  }
  if (d.cal) { calOpen = calOpen === d.cal ? null : d.cal; render(); return; }
  if (d.ics) { const e = findEvent(d.ics); if (e) { downloadIcs(e); calOpen = null; render(); } return; }
  if (d.share) {
    const e = findEvent(d.share);
    if (!e) return;
    const text = `${e.n} · ${fmtShort(e.s)}${e.t ? " " + e.t : ""} · ${e.v}`;
    const url = e.u || location.href.split("#")[0] + "#" + state.city;
    try {
      if (navigator.share) await navigator.share({ title: e.n, text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); toast("Link copied"); }
    } catch { /* share sheet dismissed */ }
    return;
  }
  if (t.id === "savedBtn") { state.view = state.view === "saved" ? "day" : "saved"; state.q = ""; $("q").value = ""; render(); window.scrollTo({ top: 0 }); return; }
  if (t.id === "homeBtn") { $("homeMsg").textContent = ""; $("homeInput").value = home?.label || ""; $("homeDialog").showModal(); return; }
});

// Swap a broken event photo for the category cover.
document.addEventListener("error", (ev) => {
  const img = ev.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.fallback) return;
  const cover = img.parentElement;
  cover.classList.add("art");
  img.replaceWith(Object.assign(document.createElement("div"), { className: "tile", innerHTML: svg(ICON[cover.dataset.c] || ICON.community) }));
}, true);

let searchTimer;
$("q").addEventListener("input", (ev) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.q = ev.target.value; if (state.view === "saved") state.view = "day"; render(); }, 180);
});

/* ---------- home location ---------- */
function setHome(h) { home = h; store.set("home", h); render(); }
$("homeFind").addEventListener("click", async () => {
  const q = $("homeInput").value.trim();
  if (!q) { $("homeMsg").textContent = "Type a ZIP code or a town name."; return; }
  $("homeMsg").textContent = "Looking that up…";
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=en&countryCode=US`);
    const body = await res.json();
    const hits = body.results || [];
    const pick = hits.find((r) => r.admin1 === "Ohio") || hits[0];
    if (!pick) { $("homeMsg").textContent = "Couldn't find that place. Try a ZIP code or nearby town."; return; }
    setHome({ label: /^\d{5}$/.test(q) ? q : pick.name, lat: pick.latitude, lng: pick.longitude });
    $("homeMsg").textContent = `Home set to ${pick.name}, ${pick.admin1 || ""}.`;
  } catch { $("homeMsg").textContent = "Couldn't reach the lookup service. Check your connection and try again."; }
});
$("homeGeo").addEventListener("click", () => {
  if (!navigator.geolocation) { $("homeMsg").textContent = "This browser can't share your location. Type a ZIP code instead."; return; }
  $("homeMsg").textContent = "Finding you…";
  navigator.geolocation.getCurrentPosition(
    (pos) => { setHome({ label: "My location", lat: pos.coords.latitude, lng: pos.coords.longitude }); $("homeMsg").textContent = "Home set to your current location."; },
    () => { $("homeMsg").textContent = "Location permission was declined. Type a ZIP code instead."; },
    { maximumAge: 600000, timeout: 10000 }
  );
});
$("homeClear").addEventListener("click", () => { setHome(null); $("homeInput").value = ""; $("homeMsg").textContent = "Home cleared."; });

/* ---------- data ---------- */
window.addEventListener("hashchange", () => {
  const h = location.hash.slice(1);
  if (CITIES.some((c) => c.id === h)) { Object.assign(state, { city: h, zone: "all", cat: "all" }); render(); loadWeather(); }
});

async function loadWeather() {
  const c = cityObj();
  if (weather[c.id]) return;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&daily=weather_code,temperature_2m_max,precipitation_probability_max&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=16`;
    const body = await (await fetch(url)).json();
    const days = {};
    (body.daily?.time || []).forEach((day, i) => {
      days[day] = { code: body.daily.weather_code[i], hi: Math.round(body.daily.temperature_2m_max[i]), pop: body.daily.precipitation_probability_max?.[i] };
    });
    weather[c.id] = days;
    if (state.city === c.id) renderDays();
  } catch { /* weather is optional */ }
}

async function load() {
  render();
  loadWeather();
  const results = await Promise.allSettled(CITIES.map(async (c) => {
    const res = await fetch(`data/${c.id}.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    const body = await res.json();
    data[c.id] = body.events || [];
    updated[c.id] = body.updated;
  }));
  if (results.every((r) => r.status === "rejected")) {
    $("title").textContent = "Events couldn't load";
    $("sub").textContent = "Check your connection and reopen the app.";
    return;
  }
  render();
}

load();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
