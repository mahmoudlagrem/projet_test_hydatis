# Design note – Nordia support tickets

**Understanding and assumptions.** A support agent needs to find the right ticket quickly (search, filters,
"urgent first") and update its status without doubt about whether the change was saved. The API is deliberately
unreliable, so the real subject is honest feedback under failure. Assumptions: one agent's view, no auth; 60
tickets means client-side filtering is fine; "priority" sorts by business order (urgent > high > medium > low),
not alphabetically; the only forbidden transition is the one the API forbids (`resolved → open`), so
`resolved → in_progress` stays allowed.

**Architecture.** React + TypeScript + Vite, no extra runtime library. Three layers: a typed API client
(timeout, retries, runtime validation, `ApiError`), pure functions for filter/sort/paginate/URL parsing, and two
hooks: `useTickets` (load state + optimistic status change with rollback) and `useUrlQuery` (the URL is the state
of the view, so any view can be shared). Components are thin.
*Hesitation 1 – optimistic vs. pessimistic update.* With 1 call in 8 failing, an optimistic update will roll back
visibly from time to time. I kept optimistic (the agent sees the result instantly) but made the rollback
explicit: an inline alert saying it was not saved and what the status is now, with Retry only when it can work.
*Hesitation 2 – React Query vs. hand-written hooks.* React Query gives retries and caching for free, but the need
is one list and one mutation; ~100 lines I can explain line by line seemed better for this exercise. On a real
product with more endpoints I would switch.

**Tests.** 23 tests (Vitest + Testing Library): pure logic (filters, sort, pagination, URL), the API client's retry
policy, and user journeys including 500 → rollback → retry, 409 → rollback without retry, and keyboard
open/close with focus return. The API is faked in memory to make failures deterministic. I checked the tests
catch regressions by breaking the rollback and the retry rule on purpose. Not tested automatically: real browsers,
mobile layout, screen readers (checked by hand only).

**What I cut.** Focus trap in the mobile full-screen panel, polling/refresh to see colleagues' changes, server-side
filtering (not offered by the API), browser end-to-end tests (Playwright). Reason: the time box, and they matter
less than correct failure handling.

**AI usage.** <!-- TO FILL HONESTLY: e.g. "I used Claude Code to scaffold the project and draft components,
tests and this README. I reviewed every file, ran the tests, broke the code on purpose to check the tests fail,
ran the app against the real mock API and fixed issues it introduced (e.g. `"type": "module"` broke the provided
CommonJS server.js; fixed with mock-api/package.json). Decisions X and Y were mine / I changed Z." -->

**With one more day.** Playwright tests against the real mock server (including mobile viewport); focus trap and
Back-button closing on the mobile panel; refresh/polling with conflict display when a ticket changed under you;
undo on status change; counts per status in the filters.
