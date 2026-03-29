# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test               # Run all Jest tests
npm run test:watch     # Watch mode for development
npm run test:coverage  # Generate coverage report
```

To run a single test file:
```bash
npx jest tests/utils.test.js
```

There is no build step — this is a vanilla JS project served directly as static files. Open `index.html` in a browser or use any static file server.

## Architecture

This is a **vanilla JavaScript SPA** (no framework) for travel itinerary planning with a Supabase backend.

### Module Structure

All JS lives in `js/` and is loaded as `<script type="module">` from `index.html`:

- **`utils.js`** — Global state (`trips[]`, `currentTrip`), XSS escaping (`escapeHTML()`), toast notifications
- **`auth.js`** — Supabase client init, Google OAuth, cloud CRUD (`loadTripsFromCloud`, `saveToCloud`, `deleteFromCloud`), sharing/collaborator system
- **`editor.js`** — Trip editor modal with tabs (Basic Info / Flights / Tickets / Daily Itinerary), geocode modal integration, `saveFormEditor()`
- **`rendering.js`** — All DOM rendering: `renderHome()` (trip cards), `showTrip()` (detail view), flight/day/activity rendering
- **`weather.js`** — Open-Meteo API integration, WMO code mapping, outfit tips, sessionStorage caching

### Data Flow

1. Google OAuth → Supabase session → `loadTripsFromCloud()` syncs to local `trips[]`
2. `renderHome()` shows trip cards; clicking opens `showTrip()` detail view
3. Editor modal populates from `currentTrip`, saves via `saveFormEditor()` → `saveToCloud()`
4. Weather loads async per-day via `loadWeatherForDay()` with sessionStorage cache
5. Offline fallback: localStorage (`STORAGE_KEY`) used when unauthenticated

### Database (Supabase)

Three tables with Row Level Security (RLS):
- `trips` — JSONB itinerary data, owner-isolated
- `shares` — Time-limited share tokens with view/edit permissions
- `collaborators` — Per-trip role-based access

Schema and RLS policies documented in `supabase-setup.md`.

### Testing

Tests use Jest + jsdom. Each test file mocks the Supabase client globally and sets up minimal DOM. Modules expose functions via `window.*` in browser and `module.exports` in test environment (detected via `typeof module !== 'undefined'`).

### Security

All user-generated content must pass through `escapeHTML()` before DOM insertion. The Supabase anon key in `auth.js` is the public-safe publishable key — RLS policies enforce data isolation server-side.

### External Dependencies (CDN, no npm install)

Tailwind CSS, Font Awesome, Leaflet.js (maps), SortableJS (drag-and-drop), Supabase JS SDK — all loaded via `<script>` tags in `index.html`.
