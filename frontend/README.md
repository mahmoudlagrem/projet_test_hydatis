# Nordia – Support tickets

A small dashboard for Nordia's support team: list, search, filter, sort and paginate tickets, open a ticket in a
detail panel, and change its status with immediate feedback and a clean rollback when the API refuses or fails.

React 18 + TypeScript + Vite. Tests with Vitest and Testing Library. No UI library, no state library.

## Run it

Requires Node.js 18 or later.

```bash
npm install
npm run api      # terminal 1 – mock API on http://localhost:3001 (provided files, unchanged, in mock-api/)
npm run dev      # terminal 2 – app on http://localhost:5173
```

The app calls `/api/...`; Vite proxies it to the mock API (`API_URL=http://host:port npm run dev` to point elsewhere).

Other scripts: `npm test` (tests once), `npm run test:watch`, `npm run typecheck`, `npm run build && npm run preview`.

## What is in it

| Must have | Where |
|---|---|
| List (title, customer, priority, status, date), search, filter by status and priority | `Toolbar`, `TicketList`, `lib/query.ts` |
| Sort by date and by priority | `lib/query.ts` → `sortTickets` |
| Detail panel | `DetailPanel` |
| Status change with immediate feedback and failure handling | `lib/useTickets.ts` → `changeStatus` |
| Loading, error, empty states | `App.tsx` |
| Mobile and keyboard | CSS (table → cards under 760px, full-screen panel), focus management, see below |
| ≥ 6 tests | 23 tests, see below |

Also done (the "if time allows" list): **pagination** (15 per page), **shareable URL** (search, filters, sort,
page and the open ticket are all in the address bar), **dark mode** (follows the OS, toggle saved locally).

## Choices

- **All filtering, sorting and paging happen in the browser.** The API only returns the full list, and 60 tickets
  is tiny. If the API grew to thousands of tickets, these would move server-side; the logic is isolated in pure
  functions (`lib/query.ts`), so the change would be contained.
- **The URL is the single source of truth** for what is on screen (`useUrlQuery`). Anything invalid in the URL
  falls back to the default instead of crashing. `replaceState` is used so typing does not flood the history.
- **Optimistic status change.** The new status shows immediately (badge in the list and in the panel, with a
  spinner). On success the server's version replaces ours (new `updatedAt`). On failure the status rolls back and
  an inline alert explains why:
  - **500 / network / timeout** → "Retry" button (setting a status is idempotent, so retrying is safe);
  - **409** (resolved ticket reopened) → no Retry, because it would fail again.
- **"Open" is disabled for a resolved ticket**, with a hint. The API still enforces the rule (it is the source of
  truth, e.g. if a colleague resolved the ticket meanwhile); the UI just avoids a guaranteed failure. Note that the
  API only forbids `resolved → open`; `resolved → in_progress` is allowed, and the UI follows that exactly.
- **Retries: automatic for reads, manual for writes.** `GET /tickets` is retried up to 2 times on 5xx/network
  errors (with 1 call in 8 failing, an unretried first load would fail ~12% of the time). A status change is
  never retried silently: the user sees the failure and chooses.
- **Status buttons, not a `<select>`.** On some browsers, arrow keys on a closed select fire `change` at each step,
  which would send one PATCH per keystroke. Buttons are explicit, and `aria-pressed` marks the current status.
- **Defensive API layer** (`lib/api.ts`): 8s timeout, typed `ApiError`, response records are validated at runtime
  and malformed ones dropped, ids URL-encoded. All text is rendered by React (escaped), no `dangerouslySetInnerHTML`.
- **No extra libraries** (React Query, router, UI kit). The needs were small, and every line can be explained.

## Keyboard and accessibility

- Tab goes through the toolbar, then one stop per ticket (the title button). Enter opens the panel and moves focus
  to its heading. Escape closes it and gives focus back to the ticket you came from.
- "Skip to tickets" link, visible focus ring, real `<table>` with a caption, labelled form controls.
- Loading, result counts and save results are announced (`role="status"`, `aria-live`, `role="alert"` for errors).
- Colour is never the only signal (badges carry text). Respects `prefers-reduced-motion`.

## Tests

`npm test` – 23 tests in 3 files:

- `lib/query.test.ts` – filtering (combined filters, accents, search by `#id`), sorting by date and by business
  priority with tie-break, pagination clamping, URL round-trip and hostile URL values.
- `lib/api.test.ts` – GET retried on 500, gives up after 3 tries, malformed records dropped, 409 not retried.
- `App.test.tsx` – the user journeys: loading → list; error → "Try again"; filters + URL + empty state; restoring
  a shared URL; optimistic success; 500 → rollback → Retry; 409 → rollback, no Retry; "Open" disabled when resolved;
  keyboard open/close with focus return.

API calls are faked with a small in-memory version of the mock API (`src/test/fakeApi.ts`), which lets tests force a
500 or a 409 deterministically instead of relying on the real server's randomness. To check the tests are not
trivially green, I broke the rollback and the retry policy on purpose: the relevant tests failed.

## Known limits

- On mobile the panel covers the screen but does not trap focus; Tab can reach the list behind it.
- No automated test in a real browser (layout, mobile, real network). Checked by hand against the real mock API.
- No refresh/polling: the list is loaded once. Changes made by others are not seen until reload.
- If two status changes are made on two different tickets quickly, both work; on the *same* ticket, the second
  click is ignored until the first one finishes.
