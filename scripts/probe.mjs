// Temporary: looks for more Columbus-area event feeds. Removed after use.
const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const end = new Date(Date.now() + 27 * 864e5).toISOString().slice(0, 10).replace(/-/g, "");
const UA = { "User-Agent": "Mozilla/5.0 (compatible; OhioDaybook/1.0)" };
async function get(url, headers = {}) {
  const res = await fetch(url, { headers: { ...UA, ...headers }, redirect: "follow", signal: AbortSignal.timeout(20000) });
  return { status: res.status, url: res.url, type: res.headers.get("content-type") || "", text: await res.text() };
}
async function ics(url) {
  try {
    const r = await get(url.replace(/^webcal:/, "https:"), { Accept: "text/calendar,*/*" });
    if (!/BEGIN:VCALENDAR/.test(r.text)) return { url, status: r.status, ics: false };
    const starts = [...r.text.matchAll(/DTSTART[^:]*:(\d{8})/g)].map((m) => m[1]);
    const summaries = [...r.text.matchAll(/\nSUMMARY[^:]*:([^\r\n]*)/g)].map((m) => m[1]).slice(0, 4);
    const locs = [...r.text.matchAll(/\nLOCATION[^:]*:([^\r\n]*)/g)].map((m) => m[1]).slice(0, 3);
    const attach = /\nATTACH/.test(r.text);
    return { url, ics: true, events: starts.length, upcoming: starts.filter((d) => d >= today && d <= end).length, summaries, locs, attach };
  } catch (e) { return { url, error: String(e.message || e).slice(0, 60) }; }
}
const out = { tribe: [], civic: [], json: [], athletics: [] };

// WordPress "The Events Calendar" sites: ?ical=1 on the events list
const tribe = [
  "https://columbuscommons.org/events/", "https://www.ohiocraft.org/events/", "https://www.ohioexpocenter.com/events/",
  "https://www.operacolumbus.org/events/", "https://www.balletmet.org/events/", "https://shortnorthstage.org/events/",
  "https://nationalvmm.org/events/", "https://www.kingartscomplex.com/events/", "https://lincolntheatrecolumbus.com/events/",
  "https://www.upperarlingtonoh.gov/events/", "https://bexley.org/events/", "https://www.columbuszoo.org/events",
  "https://www.eastontowncenter.com/events", "https://www.polarisfashionplace.com/events", "https://franklintonartsdistrict.com/events/",
  "https://www.gatewayfilmcenter.org/events/", "https://www.columbusrecparks.com/events/", "https://www.scioto-mile.com/events/",
  "https://www.dublinohiousa.gov/events/list/", "https://visitdublinohio.com/events/", "https://www.visitwesterville.org/events/",
  "https://www.grovecityohio.gov/calendar/", "https://www.worthingtonlibraries.org/events", "https://www.columbusalive.com/events",
  "https://www.wosu.org/events/", "https://www.columbuscraftbeerweek.com/events/", "https://www.ohiostatefair.com/events/",
  "https://www.cbusbrews.com/events/", "https://www.innovationcolumbus.org/events/", "https://www.columbusarts.com/events/",
  "https://www.experiencegrandview.com/events/", "https://www.uptownwesterville.com/events/", "https://www.downtowndelaware.org/events/",
  "https://www.olentangyriver.org/events/", "https://www.audubon.org/events", "https://www.cmhfilm.org/events/",
  "https://www.thecolumbusfoundation.org/events/", "https://www.franklinparkconservatory.org/events/", "https://www.oldnorthcolumbus.org/events/",
  "https://www.clintonvillechamber.com/events/", "https://www.southsideroots.org/events/", "https://www.harvestpizzeria.com/events/",
  "https://www.ohiotheatre.org/events/", "https://www.capa.com/events/", "https://www.columbusmakesart.com/events/",
];
await Promise.all(tribe.map(async (p) => {
  const row = { page: p };
  try {
    const r = await get(p);
    row.status = r.status;
    const links = [...new Set([...r.text.matchAll(/((?:webcal|https?):\/\/[^"'\s<>]*?(?:\.ics|ical=1|icalendar)[^"'\s<>]*)/gi)].map((m) => m[1].replace(/&amp;|&#038;/g, "&")))].slice(0, 3);
    row.found = await Promise.all(links.map(ics));
  } catch (e) { row.error = String(e.message || e).slice(0, 60); }
  row.param = await ics(p + (p.includes("?") ? "&" : "?") + "ical=1");
  out.tribe.push(row);
}));

// CivicPlus city calendars: /iCalendar.aspx lists subscribe feeds
const civic = ["https://www.worthington.org", "https://www.gahanna.gov", "https://www.grandviewheights.gov", "https://www.westerville.org",
  "https://www.uaoh.net", "https://www.reynoldsburg.gov", "https://www.pickerington.net", "https://www.powellohio.gov", "https://www.whitehallohio.gov",
  "https://www.canalwinchesterohio.gov", "https://www.delawareohio.net", "https://www.lewiscenter.org", "https://www.groveport.org", "https://www.marysvilleohio.org",
  "https://www.dublinohiousa.gov", "https://www.grovecityohio.gov", "https://www.hilliardohio.gov"];
await Promise.all(civic.map(async (base) => {
  const row = { base };
  try {
    const r = await get(base + "/iCalendar.aspx");
    row.status = r.status;
    const feeds = [...new Set([...r.text.matchAll(/(\/?common\/modules\/iCalendar\/iCalendar\.aspx\?[^"'\s<>]+)/gi)].map((m) => new URL(m[1].replace(/&amp;/g, "&"), base + "/").href))];
    row.feedCount = feeds.length;
    const names = [...r.text.matchAll(/iCalendar\.aspx\?catID=(\d+)[^>]*>([^<]{0,60})/gi)].map((m) => m[1] + ":" + m[2].trim()).slice(0, 12);
    row.names = names;
    const all = feeds.find((f) => /catID=14\b/.test(f)) || feeds[0];
    row.sample = all ? await ics(all) : null;
    row.allEvents = await ics(base + "/common/modules/iCalendar/iCalendar.aspx?feed=calendar");
  } catch (e) { row.error = String(e.message || e).slice(0, 60); }
  out.civic.push(row);
}));

// JSON calendars (Localist / LibCal / Communico)
const json = [
  "https://events.osu.edu/api/2/events?days=28&pp=5", "https://calendar.columbusstate.edu/api/2/events?days=28&pp=5",
  "https://www.columbuslibrary.org/wp-json/tribe/events/v1/events?per_page=5", "https://columbuslibrary.libcal.com/",
  "https://www.columbusmuseum.org/wp-json/tribe/events/v1/events?per_page=5", "https://www.metroparks.net/wp-json/tribe/events/v1/events?per_page=5",
  "https://www.fpconservatory.org/wp-json/tribe/events/v1/events?per_page=5", "https://downtowncolumbus.com/wp-json/tribe/events/v1/events?per_page=5",
  "https://events.otterbein.edu/api/2/events?days=28&pp=5", "https://events.capital.edu/api/2/events?days=28&pp=5",
  "https://www.cosi.org/wp-json/tribe/events/v1/events?per_page=5", "https://www.wexarts.org/api/events",
];
await Promise.all(json.map(async (u) => {
  try {
    const r = await get(u, { Accept: "application/json" });
    let n = null; let sample = null;
    try { const j = JSON.parse(r.text); n = (j.events || []).length; const e = (j.events || [])[0]; sample = e && JSON.stringify(e).slice(0, 300); } catch {}
    out.json.push({ u, status: r.status, type: r.type.slice(0, 30), n, sample });
  } catch (e) { out.json.push({ u, error: String(e.message || e).slice(0, 60) }); }
}));

// Sidearm sample to learn summary/location format
out.athletics.push(await ics("https://ohiostatebuckeyes.com/calendar.ashx/calendar.ics?sport_id=0"));
out.athletics.push(await ics("https://www.fpconservatory.org/events/?ical=1"));
out.athletics.push(await ics("https://www.metroparks.net/events/?ical=1"));

console.log("PROBE_JSON_START");
console.log(JSON.stringify(out));
console.log("PROBE_JSON_END");
