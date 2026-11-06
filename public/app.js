// Ohio Daybook front end: reads data/<city>.json (written by scripts/refresh.mjs).
const CITIES = [
  { id: "columbus", name: "Columbus", zones: { core: "Columbus", near: "Suburbs", trip: "Day trips" } },
  { id: "cleveland", name: "Cleveland", zones: { core: "Cleveland", near: "Suburbs", trip: "Day trips" } },
  { id: "cincinnati", name: "Cincinnati", zones: { core: "Cincinnati", near: "Suburbs & NKY", trip: "Day trips" } },
  { id: "dayton", name: "Dayton", zones: { core: "Dayton", near: "Suburbs", trip: "Day trips" } },
  { id: "akron", name: "Akron", zones: { core: "Akron", near: "Kent & suburbs", trip: "Day trips" } },
  { id: "toledo", name: "Toledo", zones: { core: "Toledo", near: "Suburbs", trip: "Day trips" } },
];
const CATS = { music: "Music", sports: "Sports", arts: "Arts & theater", comedy: "Comedy", family: "Family & lights", festival: "Festivals", market: "Markets", food: "Food & drink", community: "Community" };
const LONG_RUN = 6; // events spanning more than this many days go under "Still running"
const WINDOW = 28;

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const spanDays = (e) => (e.e ? Math.round((parse(e.e) - parse(e.s)) / 864e5) : 0);
const fmtShort = (s) => parse(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

const today = new Date(); today.setHours(0, 0, 0, 0);
const DAYS = [];
for (let i = 0; i < WINDOW; i++) { const d = new Date(today); d.setDate(d.getDate() + i); DAYS.push(iso(d)); }

const data = {};
const updated = {};
const fromHash = location.hash.slice(1);
const remembered = store.get("city");
const state = {
  city: CITIES.some((c) => c.id === fromHash) ? fromHash : CITIES.some((c) => c.id === remembered) ? remembered : "columbus",
  day: DAYS[0], zone: "all", cat: "all",
};

const onDay = (e, day) => e.s <= day && (e.e || e.s) >= day;

function renderCities() {
  const box = $("cities");
  box.innerHTML = "";
  for (const c of CITIES) {
    const b = document.createElement("button");
    b.className = "city"; b.id = `tab-${c.id}`;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", c.id === state.city);
    const n = (data[c.id] || []).filter((e) => onDay(e, state.day)).length;
    b.innerHTML = esc(c.name) + (data[c.id] ? `<small>${n}</small>` : "");
    b.onclick = () => {
      Object.assign(state, { city: c.id, zone: "all", cat: "all" });
      store.set("city", c.id);
      history.replaceState(null, "", `#${c.id}`);
      render();
    };
    box.append(b);
  }
}

function renderDays() {
  const box = $("days");
  const keep = box.scrollLeft;
  box.innerHTML = "";
  const evs = data[state.city] || [];
  for (const day of DAYS) {
    const d = parse(day);
    const n = evs.filter((e) => onDay(e, day) && spanDays(e) <= LONG_RUN).length;
    const b = document.createElement("button");
    b.className = "day" + (n ? "" : " empty") + ([0, 6].includes(d.getDay()) ? " wknd" : "");
    b.id = `day-${day}`;
    b.setAttribute("aria-pressed", day === state.day);
    b.setAttribute("aria-label", `${d.toDateString()}, ${n} events`);
    const wd = day === iso(today) ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" });
    b.innerHTML = `<i>${wd}</i><b>${d.getDate()}</b><span class="dots">${"<span></span>".repeat(Math.min(3, Math.ceil(n / 4)))}</span>`;
    b.onclick = () => { state.day = day; render(); };
    box.append(b);
  }
  box.scrollLeft = keep;
}

function chipRow(el, items, current, onPick) {
  el.innerHTML = "";
  for (const [key, label, count] of items) {
    if (key !== "all" && !count) continue;
    const b = document.createElement("button");
    b.className = "chip"; b.id = `${el.id}-${key}`;
    b.setAttribute("aria-pressed", key === current);
    b.innerHTML = `${esc(label)}<em>${count}</em>`;
    b.onclick = () => onPick(key);
    el.append(b);
  }
}

function evHTML(e, city, compact) {
  const span = spanDays(e);
  const run = e.e ? `<span class="tag run">${span > LONG_RUN ? "Through " + fmtShort(e.e) : fmtShort(e.s) + " – " + fmtShort(e.e)}</span>` : "";
  const zone = e.z !== "core" ? `<span class="tag zone">${esc(city.zones[e.z])}</span>` : "";
  const link = e.u && /^https?:\/\//.test(e.u) ? `<a class="link" href="${esc(e.u)}" target="_blank" rel="noopener">Details ↗</a>` : "";
  const tags = `<div class="tags">${run}${zone}<span class="tag">${esc(CATS[e.c] || e.c)}</span>${link}</div>`;
  const where = `${esc(e.v)}${e.a ? " · " + esc(e.a) : ""}`;
  if (compact) {
    return `<div class="ev"><div class="b"><h3>${esc(e.n)}</h3><div class="where">${where}${e.t ? " · " + esc(e.t) : ""}</div>${tags}</div></div>`;
  }
  return `<article class="ev"><div class="t ${e.t ? "" : "allday"}">${esc(e.t || "All day")}</div><div class="b"><h3>${esc(e.n)}</h3><div class="where">${where}</div>${e.d ? `<p class="d">${esc(e.d)}</p>` : ""}${tags}</div></article>`;
}

function render() {
  renderCities(); renderDays();
  const city = CITIES.find((c) => c.id === state.city);
  const d = parse(state.day);
  $("dayTitle").textContent = (state.day === iso(today) ? "Today, " : "") + d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const evs = data[state.city];
  if (!evs) { $("zones").innerHTML = $("cats").innerHTML = $("out").innerHTML = ""; return; }

  const all = evs.filter((e) => onDay(e, state.day));
  const zoneCount = (z) => all.filter((e) => e.z === z).length;
  chipRow($("zones"), [["all", "Everywhere", all.length], ...Object.entries(city.zones).map(([k, l]) => [k, l, zoneCount(k)])], state.zone,
    (k) => { state.zone = k; state.cat = "all"; render(); });
  const inZone = all.filter((e) => state.zone === "all" || e.z === state.zone);
  if (state.zone !== "all" && !inZone.length) { state.zone = "all"; return render(); }
  chipRow($("cats"), [["all", "All types", inZone.length], ...Object.entries(CATS).map(([k, l]) => [k, l, inZone.filter((e) => e.c === k).length])], state.cat,
    (k) => { state.cat = k; render(); });
  const shown = inZone.filter((e) => state.cat === "all" || e.c === state.cat);
  if (state.cat !== "all" && !shown.length) { state.cat = "all"; return render(); }

  const main = shown.filter((e) => spanDays(e) <= LONG_RUN).sort((a, b) => a.m - b.m);
  const running = shown.filter((e) => spanDays(e) > LONG_RUN);
  const where = state.zone === "near" ? " suburbs" : state.zone === "trip" ? " day-trip range" : state.zone === "all" ? " and nearby" : "";
  $("daySub").textContent = `${main.length} happening in ${city.name}${where}` + (running.length ? `, plus ${running.length} still running` : "");

  let html = main.length
    ? `<div class="list">${main.map((e) => evHTML(e, city)).join("")}</div>`
    : `<div class="note"><strong>Nothing listed for ${esc(city.name)} on this day yet</strong>Try a nearby date, or check the long-running picks below.</div>`;
  if (running.length) html += `<p class="sect">Still running</p><div class="list running">${running.map((e) => evHTML(e, city, true)).join("")}</div>`;
  $("out").innerHTML = html;
  $("foot").textContent = `${city.name} listings updated ${updated[state.city] ? fmtShort(updated[state.city]) : "—"}. Sources: Ticketmaster, SeatGeek, public event calendars and hand-picked local events. Times change, so check with the venue before you go.`;

  const sel = $(`day-${state.day}`);
  const box = $("days");
  if (sel) {
    const left = sel.offsetLeft - box.offsetLeft;
    if (left < box.scrollLeft || left + sel.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = left - 12;
  }
}

window.addEventListener("hashchange", () => {
  const h = location.hash.slice(1);
  if (CITIES.some((c) => c.id === h)) { Object.assign(state, { city: h, zone: "all", cat: "all" }); render(); }
});

async function load() {
  render();
  $("range").textContent = `${fmtShort(DAYS[0])} – ${fmtShort(DAYS[DAYS.length - 1])}`;
  const results = await Promise.allSettled(CITIES.map(async (c) => {
    const res = await fetch(`data/${c.id}.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    const body = await res.json();
    data[c.id] = body.events || [];
    updated[c.id] = body.updated;
  }));
  if (results.every((r) => r.status === "rejected")) {
    $("dayTitle").textContent = "Events couldn't load";
    $("daySub").textContent = "Check your connection and pull to refresh. If you just set up the site, run the Refresh events workflow once.";
    return;
  }
  render();
}

load();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
