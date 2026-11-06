# Ohio Daybook

Day-by-day events for Columbus and its suburbs, plus Cleveland, Cincinnati, Dayton, Akron and Toledo, each on its own tab. It runs as a web app you can add to your phone's home screen, and it refreshes itself every morning.

**How it stays up to date:** a GitHub Action runs every day. It pulls the next four weeks of events from Ticketmaster and SeatGeek plus any public calendar feeds you list, merges them with your hand-picked events, saves the result to `public/data/` and republishes the site on GitHub Pages. There's no server to run and it costs nothing.

## One-time setup (about 15 minutes)

1. **Get two free API keys**
   - Ticketmaster: sign up at <https://developer.ticketmaster.com>, open *My Apps* and copy the **Consumer Key**.
   - SeatGeek: sign in at <https://seatgeek.com/account/develop>, create an app and copy the **Client ID**.
   Either one alone works; both give the best coverage.

2. **Put the code on GitHub**
   - Create a new repository (for example `ohio-daybook`) at <https://github.com/new>.
   - Upload the contents of this folder (drag and drop on the repo page works), or from a terminal:
     ```
     git init && git add . && git commit -m "Ohio Daybook"
     git branch -M main
     git remote add origin https://github.com/<you>/ohio-daybook.git
     git push -u origin main
     ```

3. **Add the keys as secrets**
   Repo → *Settings* → *Secrets and variables* → *Actions* → *New repository secret*:
   - `TICKETMASTER_API_KEY` = your Ticketmaster Consumer Key
   - `SEATGEEK_CLIENT_ID` = your SeatGeek Client ID

4. **Turn on GitHub Pages**
   Repo → *Settings* → *Pages* → *Source*: **GitHub Actions**.

5. **Run the first refresh**
   Repo → *Actions* → *Refresh events* → *Run workflow*. After a minute or two the site is live at
   `https://<you>.github.io/ohio-daybook/`.

6. **Install it on your phone**
   Open that link on your phone. On iPhone use Safari → Share → *Add to Home Screen*. On Android, Chrome → ⋮ → *Install app*.

After that it refreshes every morning on its own. You can also refresh any time with *Run workflow*.

## Customizing

| What | Where |
|---|---|
| Cities, map center, search radius, what counts as "nearby" | `config/cities.json` |
| Extra calendar feeds (city, venue, district calendars) | `icalFeeds` in `config/cities.json` |
| Hand-picked events the ticketing sites miss (craft fairs, light shows, markets) | `config/curated-events.json` |
| Refresh time | `cron` line in `.github/workflows/refresh.yml` |
| Look and feel | `public/styles.css`, `public/app.js` |

**Zones.** Each event is tagged by where it is relative to the city: *core* (the venue is in the city itself), *near* (within `nearMiles`, 35 by default, so suburbs like Dublin, Westerville or Easton-area venues outside city limits) or *trip* (up to `radiusMiles`, 75 by default).

**Adding a calendar feed.** Many local event sites built on WordPress export iCal at `<their events page>?ical=1`. Others have an "Export" or "Subscribe" link that gives a `.ics` URL. Add it like this:

```json
{ "name": "Short North Alliance", "url": "https://example.org/events/?ical=1", "zone": "core", "area": "Short North" }
```

`zone`, `area` and `category` are optional. If a feed stops working, the refresh logs a warning and carries on. The two feeds included to start (Downtown Columbus and Visit Toledo) follow that pattern; check the first run's log to confirm they respond.

**Adding curated events.** Add an entry under the city in `config/curated-events.json`:

```json
{ "s": "2026-12-05", "e": "2026-12-06", "t": "10 AM", "n": "Holiday Craft Show", "v": "Ohio Expo Center",
  "a": "North Columbus", "z": "core", "c": "market", "d": "Two days of local makers." }
```

Categories: `music sports arts comedy family festival market food community`. Past events drop off automatically.

## Running it on your computer

Requires Node.js 20 or newer. No packages to install.

```
TICKETMASTER_API_KEY=xxx SEATGEEK_CLIENT_ID=yyy npm run refresh   # pull events
npm run serve                                                        # open http://localhost:8080
npm test                                                             # parser tests
```

## How it's built

```
config/            cities, feeds and hand-picked events
scripts/refresh.mjs   pulls every source, merges duplicates, writes public/data/<city>.json
scripts/sources/   Ticketmaster, SeatGeek and iCal readers
public/            the app itself (static HTML/CSS/JS, offline support, home-screen icons)
.github/workflows/ daily refresh + deploy
```

If one source fails during a refresh, the app keeps the still-upcoming events from the previous run, so a bad morning for one API never empties the app. When the same show appears in two sources (same venue, day and start time), it's listed once.
