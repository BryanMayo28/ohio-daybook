import { test } from "node:test";
import assert from "node:assert/strict";
import { mapTicketmasterEvent } from "../scripts/sources/ticketmaster.mjs";
import { mapSeatGeekEvent } from "../scripts/sources/seatgeek.mjs";
import { parseICS, mapICSEvent } from "../scripts/sources/ical.mjs";
import { mergeEvents, timeFrom24h, zoneFor, makeEvent } from "../scripts/lib/normalize.mjs";

const settings = { radiusMiles: 75, nearMiles: 35 };
const columbus = { id: "columbus", name: "Columbus", lat: 39.9612, lng: -82.9988, coreCities: ["Columbus"] };

test("time labels", () => {
  assert.deepEqual(timeFrom24h("19:30:00"), { t: "7:30 PM", m: 1170 });
  assert.deepEqual(timeFrom24h("12:00"), { t: "12 PM", m: 720 });
  assert.deepEqual(timeFrom24h("00:15"), { t: "12:15 AM", m: 15 });
  assert.deepEqual(timeFrom24h(undefined), { t: "", m: -1 });
});

test("zones: city, suburb, day trip", () => {
  assert.equal(zoneFor(columbus, settings, "Columbus", 0, 0), "core");
  assert.equal(zoneFor(columbus, settings, "Dublin", 40.0992, -83.1141), "near");
  assert.equal(zoneFor(columbus, settings, "Nelsonville", 39.4587, -82.2318), "trip");
});

test("Ticketmaster event maps to app shape and skips parking", () => {
  const raw = {
    name: "Columbus Blue Jackets vs. Florida Panthers",
    url: "https://www.ticketmaster.com/event/x",
    dates: { start: { localDate: "2026-11-10", localTime: "19:30:00" }, status: { code: "onsale" } },
    classifications: [{ primary: true, segment: { name: "Sports" }, genre: { name: "Hockey" }, subGenre: { name: "NHL" } }],
    _embedded: { venues: [{ name: "Nationwide Arena", city: { name: "Columbus" }, location: { latitude: "39.969", longitude: "-83.006" } }] },
  };
  const ev = mapTicketmasterEvent(raw, columbus, settings);
  assert.equal(ev.s, "2026-11-10");
  assert.equal(ev.t, "7:30 PM");
  assert.equal(ev.c, "sports");
  assert.equal(ev.z, "core");
  assert.equal(ev.d, "Hockey · NHL");
  assert.equal(mapTicketmasterEvent({ ...raw, name: "PARKING: Blue Jackets vs. Panthers" }, columbus, settings), null);
});

test("SeatGeek comedy event maps to comedy in a suburb", () => {
  const ev = mapSeatGeekEvent({
    title: "Trae Crowder", datetime_local: "2026-11-07T18:30:00", time_tbd: false, type: "comedy",
    venue: { name: "Columbus Funny Bone", city: "Columbus", location: { lat: 40.05, lon: -82.91 } },
    url: "https://seatgeek.com/x", taxonomies: [{ name: "theater" }, { name: "comedy" }],
  }, columbus, settings);
  assert.equal(ev.c, "comedy");
  assert.equal(ev.t, "6:30 PM");
  assert.equal(ev.z, "core");
});

test("iCal: folded lines, escapes, UTC conversion, all-day ranges", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "DTSTART:20261108T000000Z",
    "DTEND:20261108T030000Z",
    "SUMMARY:Gallery Hop\\, Short",
    "  North",
    "LOCATION:High Street\\, Columbus\\, OH",
    "DESCRIPTION:Galleries open new shows.",
    "URL:https://example.org/hop",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20261121",
    "DTEND;VALUE=DATE:20261225",
    "SUMMARY:Christkindlmarkt Dublin",
    "LOCATION:Riverside Crossing Park",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const [hop, market] = parseICS(ics).map((v) => mapICSEvent(v, columbus, { name: "Test feed" }, "America/New_York"));
  assert.equal(hop.n, "Gallery Hop, Short North");
  assert.equal(hop.s, "2026-11-07");          // 00:00 UTC Nov 8 = 7 PM Eastern Nov 7
  assert.equal(hop.t, "7 PM");
  assert.equal(hop.e, undefined);              // ends 10 PM same evening
  assert.equal(hop.v, "High Street");
  assert.equal(hop.c, "arts");
  assert.equal(market.s, "2026-11-21");
  assert.equal(market.e, "2026-12-24");        // DTEND is exclusive for all-day events
  assert.equal(market.c, "market");
});

test("merge: cross-source duplicates and matinee + evening shows", () => {
  const base = { v: "Ohio Theatre", a: "Columbus", z: "core", c: "arts", d: "" };
  const merged = mergeEvents([
    makeEvent({ ...base, s: "2026-11-07", t: "7:30 PM", m: 1170, n: "Maybe Happy Ending" }),
    makeEvent({ ...base, s: "2026-11-07", t: "2 PM", m: 840, n: "Maybe Happy Ending" }),
    makeEvent({ ...base, s: "2026-11-07", t: "7:30 PM", m: 1170, n: "Maybe Happy Ending (Touring)", u: "https://x" }),
    makeEvent({ ...base, s: "2026-11-08", t: "1 PM", m: 780, n: "Maybe Happy Ending" }),
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].t, "2 PM & 7:30 PM");
  assert.equal(merged[0].m, 840);
  assert.equal(merged[0].u, "https://x");
});
