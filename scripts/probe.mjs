// Temporary: checks which data fields and feeds are available. Removed after use.
const TZ_START = new Date().toISOString().slice(0, 10);
const end = new Date(Date.now() + 27 * 864e5).toISOString().slice(0, 10);
const UA = { "User-Agent": "Mozilla/5.0 (compatible; OhioDaybook/1.0)" };
const out = {};

async function get(url, opts = {}) {
  const res = await fetch(url, { headers: { ...UA, ...(opts.headers || {}) }, redirect: "follow", signal: AbortSignal.timeout(20000) });
  return { status: res.status, url: res.url, type: res.headers.get("content-type"), text: await res.text() };
}

// 1. Ticketmaster fields
try {
  const u = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${process.env.TICKETMASTER_API_KEY}&latlong=39.9612,-82.9988&radius=25&unit=miles&startDateTime=${TZ_START}T00:00:00Z&endDateTime=${end}T23:59:59Z&size=200&sort=date,asc`;
  const r = JSON.parse((await get(u)).text);
  const evs = r._embedded?.events || [];
  const atts = evs.flatMap((e) => e._embedded?.attractions || []);
  out.ticketmaster = {
    events: evs.length,
    withPriceRanges: evs.filter((e) => e.priceRanges?.length).length,
    withInfo: evs.filter((e) => e.info).length,
    withDescription: evs.filter((e) => e.description).length,
    withPleaseNote: evs.filter((e) => e.pleaseNote).length,
    withImages: evs.filter((e) => e.images?.length).length,
    attractionsWithWiki: atts.filter((a) => a.externalLinks?.wiki).length,
    attractions: atts.length,
    samples: evs.slice(0, 40).map((e) => ({
      name: e.name,
      price: e.priceRanges,
      info: (e.info || "").slice(0, 200),
      desc: (e.description || "").slice(0, 200),
      img: (e.images || []).filter((i) => i.ratio === "16_9").map((i) => `${i.width}x${i.height} fb:${i.fallback} ${i.url}`).slice(0, 2),
      att: (e._embedded?.attractions || []).map((a) => ({ name: a.name, wiki: a.externalLinks?.wiki?.[0]?.url })),
    })),
  };
} catch (e) { out.ticketmaster = String(e); }

// 2. SeatGeek fields
try {
  const u = `https://api.seatgeek.com/2/events?client_id=${process.env.SEATGEEK_CLIENT_ID}&lat=39.9612&lon=-82.9988&range=25mi&per_page=100&datetime_local.gte=${TZ_START}T00:00:00`;
  const r = JSON.parse((await get(u)).text);
  const evs = r.events || [];
  out.seatgeek = {
    events: evs.length,
    withLowest: evs.filter((e) => e.stats?.lowest_price).length,
    withDescription: evs.filter((e) => e.description).length,
    withPerformerImage: evs.filter((e) => e.performers?.[0]?.image).length,
    samples: evs.slice(0, 25).map((e) => ({ title: e.title, stats: e.stats, desc: (e.description || "").slice(0, 150), img: e.performers?.[0]?.image, imgs: e.performers?.[0]?.images && Object.keys(e.performers[0].images) })),
  };
} catch (e) { out.seatgeek = String(e); }

// 3. Wikipedia reachability
try {
  const r = await get("https://en.wikipedia.org/api/rest_v1/page/summary/Medium_Build");
  out.wikipedia = { status: r.status, sample: r.text.slice(0, 400) };
} catch (e) { out.wikipedia = String(e); }

// 4. Candidate calendar pages: look for iCal links; also try ?ical=1
const pages = [
  "https://shortnorth.org/events/", "https://www.experiencecolumbus.com/events/", "https://www.columbusunderground.com/events",
  "https://www.metroparks.net/events/", "https://www.fpconservatory.org/events/", "https://www.columbusmuseum.org/events/",
  "https://cosi.org/events", "https://www.columbuslibrary.org/events/", "https://dublinohiousa.gov/events/",
  "https://www.westerville.org/calendar", "https://www.worthington.org/calendar.aspx", "https://www.gahanna.gov/calendar.aspx",
  "https://www.hilliardohio.gov/events/", "https://www.grovecityohio.gov/events/", "https://newalbanyohio.org/events/",
  "https://www.uaoh.net/calendar.aspx", "https://www.grandviewheights.gov/calendar.aspx", "https://www.delawareohio.net/calendar",
  "https://germanvillage.com/events/", "https://www.columbus.gov/Events", "https://www.ohiohistory.org/events/",
  "https://www.wexarts.org/events", "https://www.shadowboxlive.org/shows", "https://www.columbussymphony.com/events/",
  "https://ohiostatebuckeyes.com/calendar", "https://www.bexley.org/calendar.aspx", "https://www.pickerington.net/calendar.aspx",
  "https://www.clevelandart.org/events", "https://www.clevelandmetroparks.com/events", "https://cpl.org/events/",
  "https://www.thisiscleveland.com/events", "https://www.ohiocity.org/events", "https://www.lakewoodoh.gov/events/",
  "https://www.cincinnatiusa.com/events", "https://www.cincinnatiparks.com/events/", "https://www.cincinnatiartmuseum.org/events-programs/",
  "https://www.3cdc.org/events/", "https://washingtonpark.org/events/", "https://www.myfountainsquare.com/events",
  "https://www.downtowndayton.org/events/", "https://www.daytonartinstitute.org/events/", "https://www.metroparks.org/events/",
  "https://www.daytonmetrolibrary.org/events", "https://www.downtownakron.com/events", "https://www.summitmetroparks.org/events/",
  "https://www.akronlibrary.org/events", "https://akronartmuseum.org/events/", "https://www.toledomuseum.org/events",
  "https://metroparkstoledo.com/events/", "https://www.toledolibrary.org/events", "https://downtowntoledo.org/events/",
  "https://www.daytonflyers.com/calendar", "https://gobearcats.com/calendar", "https://goxavier.com/calendar", "https://gozips.com/calendar",
  "https://utrockets.com/calendar", "https://kentstatesports.com/calendar", "https://csuvikings.com/calendar",
];
const icsRe = /(?:href|src|data-[\w-]+)=["']((?:webcal|https?):\/\/[^"']*?(?:\.ics|ical=1|icalendar|ical\b|calendar\.ics|feed=ical)[^"']*|\/[^"']*?(?:\.ics|ical=1|iCalendar\.aspx|calendar\.ashx[^"']*ics)[^"']*)["']/gi;
const rssRe = /<link[^>]+type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/gi;

async function checkIcs(url) {
  try {
    const r = await get(url.replace(/^webcal:/, "https:"), { headers: { Accept: "text/calendar,*/*" } });
    if (!/BEGIN:VCALENDAR/.test(r.text)) return { url, status: r.status, ics: false };
    const starts = [...r.text.matchAll(/DTSTART[^:]*:(\d{8})/g)].map((m) => m[1]);
    const upcoming = starts.filter((d) => d >= TZ_START.replace(/-/g, "") && d <= end.replace(/-/g, "")).length;
    return { url, status: r.status, ics: true, events: starts.length, upcoming };
  } catch (e) { return { url, error: String(e.message || e) }; }
}

out.pages = [];
await Promise.all(pages.map(async (page) => {
  const row = { page };
  try {
    const r = await get(page);
    row.status = r.status;
    row.final = r.url;
    const links = new Set();
    for (const m of r.text.matchAll(icsRe)) links.add(new URL(m[1].replace(/&amp;/g, "&"), r.url).href.replace(/^https:\/\/webcal/, "webcal"));
    row.rss = [...r.text.matchAll(rssRe)].map((m) => new URL(m[1].replace(/&amp;/g, "&"), r.url).href).slice(0, 3);
    row.found = await Promise.all([...links].slice(0, 4).map(checkIcs));
  } catch (e) { row.error = String(e.message || e); }
  const sep = page.includes("?") ? "&" : "?";
  row.icalParam = await checkIcs(page + sep + "ical=1");
  out.pages.push(row);
}));

// 5. Sidearm-style college athletics feeds
const sidearm = ["ohiostatebuckeyes.com", "gobearcats.com", "goxavier.com", "daytonflyers.com", "gozips.com", "utrockets.com", "kentstatesports.com", "csuvikings.com"];
out.athletics = await Promise.all(sidearm.map((h) => checkIcs(`https://${h}/calendar.ashx/calendar.ics?sport_id=0`)));

console.log("PROBE_JSON_START");
console.log(JSON.stringify(out));
console.log("PROBE_JSON_END");
