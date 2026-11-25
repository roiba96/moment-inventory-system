# Moment: Inventory System for a Clothing Boutique

A phone-first web app (Hebrew, right-to-left) that tracks a small boutique's stock by designer, model
and size: what came in, what was sold, what went back, and what is left.

> This is a clean public copy made for my portfolio. It contains no real designers, suppliers, models,
> prices, accounts or keys. All names, codes and prices in the tests and the demo are made up.

## The problem

The boutique sells clothes from several designers, mostly on consignment (the designer is paid only
for what was sold). Stock was followed with written notes: an opening list, delivery notes, returns,
and a count at the end of the month. That makes it hard to know:

- what is in the store right now, and in which sizes
- what was sold this month for each designer
- which models ran out, or haven't moved for weeks
- whether a delivery note adds up

Delivery notes also come in many forms: printed, handwritten, or a list in a message.

## What the system does

- **Receive:** paste a delivery note or a simple list, or take a photo of the note. The app reads the
  lines, checks the totals and shows everything for review before saving.
- **Return to designer:** the same screen in reverse. It won't return more than there is in stock.
- **Sell:** choose a model and a size. It won't sell more than there is in stock.
- **Stock:** grouped by designer, with sizes, search and a counting mode.
- **Home:** today's sales, models to reorder, last sizes left, and stuck models.
- **Month close:** count what is left, and the app works out what was sold.
- **Monthly report:** opening, received, returned, sold and closing for each designer. A payment
  calculation can be turned on.
- **History:** every action by date, type and designer. Receipts and returns from the last week can be
  cancelled.
- **Backup:** download the stock as CSV, or everything as JSON.

## Key decisions and why

| Decision | Why |
|---|---|
| Stock is the sum of movements (received, sold, returned, adjusted) | Every number can be explained, and mistakes can be undone |
| Month close follows the owner's own method: opening + received − returned − count = sold | No need to record every sale during the month. Recorded sales are not counted twice |
| The card payment stays in the existing card terminal | The app only follows stock |
| A photo is turned into text and goes through the same reader as pasted text | One set of checks for every kind of note |
| AI results are never saved automatically | The user checks them against the note first. Unclear lines are marked |
| Items can be received without a size and sorted later | Some notes have no sizes |
| Prices and payments are off by default | Stock works without them |
| Closing a month needs an internet connection | So two devices don't close the same month twice |
| Counts in progress are kept on the device | The phone's browser can close the tab in the middle of a count |
| Only listed Google accounts can read or write, checked by the database rules | Being logged in is not enough |
| The AI key stays on a small server, which checks who is asking | The key never reaches the browser |
| The app opens in the phone's browser, also from the home screen | So Google sign-in keeps working |

## My role

I defined the problem, made the decisions, tested and deployed; Claude Code wrote the code.

## Tech stack

- **App:** plain JavaScript in one HTML page, built with a Python script and esbuild
- **Data and login:** Firebase (Firestore and Google sign-in), with an offline cache
- **Reading notes from photos:** a Cloudflare Worker that calls Google Gemini
- **Tests:** Node scripts, and browser scripts with Playwright (Python)

## Current status and results

- **Built:** everything listed under "What the system does".
- **Tests:** 23 checks of the note reader and 13 checks of the photo server pass. 13 browser scripts
  walk through the screens and print what they see, for a person to read. All 13 ran to the end in
  this copy, and the 12 that watch for page errors found none. They don't check results by themselves.
- **Not tested in this copy:** a live Firebase project and a live Gemini call. The tests use stand-ins.
- **Business results:** none published here.

## Try the demo

You need Node.js and Python 3.

1. `cd app`
2. `npm install`
3. `python build.py`
4. Open `app/dist/moment-app.html?demo=1` in a browser.

The demo uses made-up data and saves nothing. For your own data, create a Firebase project, set the
values in `.env.example` as environment variables before building, and put your own email in
`app/firestore.rules` and in `ocr-worker/worker.js`.

Tests (from the main folder; the browser scripts need the build above):

| Command | What it does |
|---|---|
| `node importer/test.js` | Checks the note reader |
| `node ocr-worker/test.mjs` | Checks the photo server, with no real AI calls |
| `python -X utf8 app/tests/t1.py` | One browser script (needs `pip install playwright` and `playwright install chromium`) |

## Folder structure

```
moment-inventory.html  The base screens and main logic, with demo data (the first prototype)
app/                   Turns the prototype into the real app:
  build.py               builds everything into one HTML page
  glue.js                login, saving, month close, returns, history, photo reading
  src/store.js           the connection to Firebase, and a stand-in for tests and the demo
  firestore.rules        who may read and write the data
  icons/                 app icons
  tests/                 browser scripts
importer/              Reads delivery notes and stock lists from text, with tests
ocr-worker/            Small server that reads a photo of a note with AI, with tests
.env.example           The settings you need to fill in
```

The app was built in steps: `build.py` takes the prototype and replaces parts of it, so the prototype
and the final app stay in one place.
