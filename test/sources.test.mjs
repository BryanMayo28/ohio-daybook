import { test } from "node:test";
import assert from "node:assert/strict";
import { mapTicketmasterEvent, pickImage } from "../scripts/sources/ticketmaster.mjs";
import { mapSeatGeekEvent } from "../scripts/sources/seatgeek.mjs";
import { parseICS, mapICSEvent } from "../scripts/sources/ical.mjs";
import { mapTribeEvent } from "../scripts/sources/tribe.mjs";
import { mergeEvents, timeFrom24h, zoneFor, makeEvent, priceFromText, isPolicyText, cleanName } from "../scripts/lib/normalize.mjs";

const columbus = { id: "columbus", name: "Columbus", lat: 39.9612, lng: -82.9988, coreCities: ["Columbus"] };
const dayton = { id: "dayton", name: "Dayton", lat: 39.7589, lng: -84.1916, coreCities: ["Dayton"] };
const settings = { radiusMiles: 60, nearMiles: 30, cities: [columbus, dayton] };

test("time labels", () => {
  assert.deepEqual(timeFrom24h("19:30:00"), { t: "7:30 PM", m: 1170 });
  assert.deepEqual(timeFrom24h("12:00"), { t: "12 PM", m: 720 });
  assert.deepEqual(timeFrom24h(undefined), { t: "", m: -1 });
});

test("zones: city, suburb, day trip", () => {
  assert.equal(zoneFor(columbus, settings, "Columbus", 0, 0), "core");
  assert.equal(zoneFor(columbus, settings, "Dublin", 40.0992, -83.1141), "near");
  assert.equal(zoneFor(columbus, settings, "Nelsonville", 39.4587, -82.2318), "trip");
});

test("prices from text and policy detection", () => {
  assert.deepEqual(priceFromText("Free admission, all ages"), { p: "Free", pm: 0 });
  assert.deepEqual(priceFromText("Tickets $20 – $30 per car"), { p: "From $20", pm: 20 });
  assert.deepEqual(priceFromText("Admission $8"), { p: "$8", pm: 8 });
  assert.equal(priceFromText("Bring the family"), null);
  assert.equal(isPolicyText("Doors open 90 minutes prior. Bags are generally NOT permitted."), true);
  assert.equal(isPolicyText("Join The George Barrie Band as they celebrate the release of their third studio album, Any Other Way."), false);
  assert.equal(cleanName("Maybe Happy Ending (Touring)"), "Maybe Happy Ending");
  assert.equal(cleanName("MashBit @ Forum - Columbus, OH - 11.06.26"), "MashBit @ Forum");
});

test("Ticketmaster: price, photo, real blurb, skips parking and other tabs' cities", () => {
  const raw = {
    name: "George Barrie Band Album Release",
    url: "https://www.ticketmaster.com/event/x",
    info: "Join The George Barrie Band as they celebrate the release of their third studio album with a full-band show.",
    priceRanges: [{ type: "standard", currency: "USD", min: 19.73, max: 19.73 }],
    images: [
      { ratio: "16_9", width: 100, url: "https://s1.ticketm.net/small.jpg", fallback: false },
      { ratio: "16_9", width: 1024, url: "https://s1.ticketm.net/big.jpg", fallback: false },
      { ratio: "16_9", width: 1024, url: "https://s1.ticketm.net/stock.jpg", fallback: true },
    ],
    dates: { start: { localDate: "2026-11-14", localTime: "20:00:00" }, status: { code: "onsale" } },
    classifications: [{ primary: true, segment: { name: "Music" }, genre: { name: "Rock" } }],
    _embedded: { venues: [{ name: "Woodlands Tavern", city: { name: "Columbus" }, location: { latitude: "39.98", longitude: "-83.02" } }], attractions: [{ name: "George Barrie Band" }] },
  };
  const ev = mapTicketmasterEvent(raw, columbus, settings);
  assert.equal(ev.p, "$19.73");
  assert.equal(ev.img, "https://s1.ticketm.net/big.jpg");
  assert.match(ev.d, /third studio album/);
  assert.equal(ev.c, "music");
  assert.equal(ev._wiki.name, "George Barrie Band");
  assert.equal(mapTicketmasterEvent({ ...raw, name: "PARKING: Blue Jackets" }, columbus, settings), null);
  const inDayton = { ...raw, _embedded: { ...raw._embedded, venues: [{ name: "Levitt Pavilion", city: { name: "Dayton" } }] } };
  assert.equal(mapTicketmasterEvent(inDayton, columbus, settings), null);
  assert.equal(pickImage([{ ratio: "16_9", width: 1024, url: "https://x/stock.jpg", fallback: true }]), undefined);
});

test("Ticketmaster: policy text becomes a generic line that Wikipedia may replace", () => {
  const ev = mapTicketmasterEvent({
    name: "Ohio State Buckeyes Men's Basketball vs. Youngstown State",
    info: "Doors open 90 minutes prior to tip-off. Bags are generally NOT permitted.",
    dates: { start: { localDate: "2026-11-06", localTime: "18:30:00" } },
    classifications: [{ segment: { name: "Sports" }, genre: { name: "Basketball" } }],
    _embedded: { venues: [{ name: "Schottenstein Center", city: { name: "Columbus" } }] },
  }, columbus, settings);
  assert.equal(ev.d, "Basketball game at Schottenstein Center.");
  assert.equal(ev.dg, 1);
  assert.equal(ev._wiki, undefined); // no Wikipedia lookups for sports
});

test("SeatGeek maps time, zone and category", () => {
  const ev = mapSeatGeekEvent({
    title: "Trae Crowder", datetime_local: "2026-11-07T18:30:00", time_tbd: false, type: "comedy",
    venue: { name: "Columbus Funny Bone", city: "Columbus", location: { lat: 40.05, lon: -82.91 } },
    url: "https://seatgeek.com/x", taxonomies: [{ name: "comedy" }], performers: [{ name: "Trae Crowder", primary: true }],
  }, columbus, settings);
  assert.equal(ev.c, "comedy");
  assert.equal(ev.t, "6:30 PM");
  assert.equal(ev._wiki.name, "Trae Crowder");
});

test("iCal: escapes, UTC conversion, all-day ranges, images, home games only", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT", "DTSTART:20261108T000000Z", "DTEND:20261108T030000Z",
    "SUMMARY:Gallery Hop\\, Short", "  North", "LOCATION:High Street\\, Columbus\\, OH",
    "DESCRIPTION:Galleries open new shows. Free to wander!", "URL:https://example.org/hop",
    "ATTACH;FMTTYPE=image/jpeg:https://example.org/hop.jpg", "END:VEVENT",
    "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261121", "DTEND;VALUE=DATE:20261225", "SUMMARY:Christkindlmarkt Dublin", "LOCATION:Riverside Crossing Park", "END:VEVENT",
    "BEGIN:VEVENT", "DTSTART:20261110T230000Z", "SUMMARY:City Council Meeting", "END:VEVENT",
    "BEGIN:VEVENT", "DTSTART:20261110T230000Z", "SUMMARY:[H] Ohio State Volleyball vs Penn State", "LOCATION:Columbus\\, Ohio", "END:VEVENT",
    "BEGIN:VEVENT", "DTSTART:20261111T230000Z", "SUMMARY:[A] Ohio State Volleyball at Wisconsin", "LOCATION:Madison\\, Wis.", "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const vevents = parseICS(ics);
  const city = vevents.map((v) => mapICSEvent(v, columbus, { name: "Test", skipMeetings: true }, "America/New_York"));
  const [hop, market, meeting] = city;
  assert.equal(hop.n, "Gallery Hop, Short North");
  assert.equal(hop.s, "2026-11-07");
  assert.equal(hop.t, "7 PM");
  assert.equal(hop.p, "Free");
  assert.equal(hop.img, "https://example.org/hop.jpg");
  assert.equal(market.e, "2026-12-24");
  assert.equal(market.c, "market");
  assert.equal(meeting, null);
  const sports = vevents.slice(3).map((v) => mapICSEvent(v, columbus, { name: "Ohio State Athletics", homeOnly: "Columbus", venue: "Ohio State campus", category: "sports" }, "America/New_York"));
  assert.equal(sports[0].n, "Ohio State Volleyball vs Penn State");
  assert.equal(sports[0].v, "Ohio State campus");
  assert.equal(sports[1], null);
});

test("Events Calendar JSON: cost, image, venue", () => {
  const ev = mapTribeEvent({
    title: "FREE Wanderlights", start_date: "2026-11-20 17:00:00", end_date: "2027-02-14 22:00:00", all_day: false,
    description: "<p>Light installations across downtown, every night from 5 to 10 PM.</p>", cost: "Free",
    image: { url: "https://columbuscommons.org/w.jpg" }, url: "https://columbuscommons.org/event/wanderlights",
    venue: { venue: "Columbus Commons", city: "Columbus", geo_lat: 39.958, geo_lng: -82.999 },
  }, columbus, settings, { name: "Columbus Commons", area: "Downtown" });
  assert.equal(ev.n, "Wanderlights");
  assert.equal(ev.p, "Free");
  assert.equal(ev.e, "2027-02-14");
  assert.equal(ev.img, "https://columbuscommons.org/w.jpg");
  assert.equal(ev.z, "core");
});

test("merge: cross-source duplicates, matinee + evening, keeps the richest fields", () => {
  const base = { v: "Ohio Theatre", a: "Columbus", z: "core", c: "arts" };
  const merged = mergeEvents([
    makeEvent({ ...base, s: "2026-11-07", t: "7:30 PM", m: 1170, n: "Maybe Happy Ending (Touring)", src: "Ticketmaster", u: "https://tm", img: "https://img", p: "From $45", pm: 45 }),
    makeEvent({ ...base, s: "2026-11-07", t: "2 PM", m: 840, n: "Maybe Happy Ending (Touring)", src: "Ticketmaster" }),
    makeEvent({ ...base, v: "Ohio Theatre - Columbus", s: "2026-11-07", t: "7 PM", m: 1140, n: "Maybe Happy Ending - Columbus", src: "SeatGeek" }),
    makeEvent({ ...base, s: "2026-11-07", t: "7:30 PM", m: 1170, n: "Maybe Happy Ending", src: "Curated", d: "Tony-winning musical about two helper robots." }),
    makeEvent({ ...base, s: "2026-11-08", t: "1 PM", m: 780, n: "Maybe Happy Ending", src: "Curated" }),
    makeEvent({ v: "Ohio Stadium", a: "Columbus", s: "2026-11-07", t: "3:30 PM", m: 930, n: "Ohio State Buckeyes Football vs. Oregon Ducks Football", src: "Ticketmaster" }),
    makeEvent({ v: "Ohio Stadium", a: "Columbus", s: "2026-11-07", t: "3:30 PM", m: 930, n: "Oregon Ducks at Ohio State Buckeyes", src: "SeatGeek" }),
  ]);
  assert.equal(merged.length, 3);
  const show = merged.find((e) => e.s === "2026-11-07" && e.v === "Ohio Theatre");
  assert.equal(show.n, "Maybe Happy Ending");
  assert.equal(show.t, "2 PM & 7:30 PM");
  assert.equal(show.u, "https://tm");
  assert.equal(show.img, "https://img");
  assert.equal(show.p, "From $45");
  assert.match(show.d, /helper robots/);
});
