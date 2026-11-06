# Ohio Daybook

Day-by-day events for Columbus and its suburbs, plus Cleveland, Cincinnati, Dayton, Akron and Toledo, each on its own tab. Every event shows a cover photo (or a category cover), the price when it's known, and a fuller description. It runs as a web app you can add to your phone's home screen and refreshes itself every morning.

Live at <https://bryanmayo28.github.io/ohio-daybook/>

## What's in the app

- **Day picker with weather** for each day, plus a **This weekend** view.
- **Filters** by area (city, suburbs, day trips), price (Free, Under $25) and category.
- **Search** across the next four weeks.
- **My plans:** tap the heart to save events, then add them to Apple, Outlook or Google Calendar.
- **Distance from home:** set a ZIP code or use your location. **Directions** and **Share** buttons on every event.
- Saved plans and your home location stay on your phone only.

## Where events come from

| Source | What it adds |
|---|---|
| Ticketmaster | Concerts, sports, theater, comedy. Official photos, prices for about a quarter of events, some descriptions |
| SeatGeek | Extra events, mainly smaller venues |
| Event Calendar sites (JSON or iCal) | Downtown Columbus, Columbus Commons, Columbus Rec & Parks, King Arts Complex, Ohio Craft Museum, Columbus Symphony, Franklin Park Conservatory, Metro Parks, Visit Westerville, Easton, New Albany, Hilliard, Downtown Dayton, Summit Metro Parks, Ohio City. Many include prices and photos |
| City calendars | Worthington, Gahanna, Reynoldsburg, Grove City, Canal Winchester (council meetings filtered out) |
| College athletics | Ohio State, Xavier, Dayton, Akron, Kent State, Toledo, Cleveland State (home games only) |
| Wikipedia | Short bios for bands, comedians and touring shows when the listing has no real description |
| Weather | Open-Meteo, free and no key |
| `config/curated-events.json` | Hand-picked events the other sources miss |

## Schedules

- **Refresh events** (`.github/workflows/refresh.yml`): every morning around 5 AM Eastern, and on every push to `main`. You can also run it any time from the Actions tab.
- **Weekend email** (`.github/workflows/digest.yml`): Thursday mornings. It stays off until you add its two secrets (below).

## Secrets (repo → Settings → Secrets and variables → Actions)

| Name | What it is |
|---|---|
| `TICKETMASTER_API_KEY` | Consumer Key from developer.ticketmaster.com |
| `SEATGEEK_CLIENT_ID` | Client ID from seatgeek.com/account/develop |
| `RESEND_API_KEY` | For the weekend email: a free API key from resend.com |
| `DIGEST_TO` | The address to send the weekend email to. On Resend's free plan without your own domain, this must be the email you signed up to Resend with |

## Customizing

| What | Where |
|---|---|
| Cities, search radius, what counts as "nearby" | `config/cities.json` |
| Calendar feeds | `feeds` in `config/cities.json` (`type: "tribe"` for WordPress Event Calendar sites, `type: "ics"` for iCal links) |
| Hand-picked events | `config/curated-events.json` |
| Look and feel | `public/styles.css`, `public/app.js` |
| Email city | `DIGEST_CITY` in `.github/workflows/digest.yml` |

Feed options: `zone` (core, near, trip), `area`, `venue`, `category`, `skipMeetings: true` for city government calendars, `homeOnly: "Columbus"` to keep only home games in an athletics feed.

## Running it on your computer

Node.js 20 or newer, no packages to install.

```
TICKETMASTER_API_KEY=xxx SEATGEEK_CLIENT_ID=yyy npm run refresh   # pull events
npm run serve                                                        # open http://localhost:8080
npm test                                                             # parser tests
node scripts/digest.mjs                                              # writes digest-preview.html
```

If one source fails during a refresh, the app keeps the still-upcoming events from the previous run. When the same show appears in more than one source, it's listed once, with the best photo, price and description combined.
