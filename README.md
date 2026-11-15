# Our little corner

Private two-person site: dates and photo memories. Source of truth: `docs/plan.md`.
UI screens: `docs/ui/Our_Date_Planner.pdf`. Status: **Phase 0 (setup) and Phase 1 (database SQL) only.**

## Run it (localhost only)

1. `npm install`
2. Check the Next.js version: `npm ls next`. This project is written for Next.js 16
   (`src/proxy.ts`). If you have 15 or older, rename `src/proxy.ts` to `src/middleware.ts`
   and the exported function `proxy` to `middleware`. To move to the newest release:
   `npm install next@latest react@latest react-dom@latest`.
3. Copy `.env.example` to `.env` and fill the values by hand (Supabase URL, publishable key
   in `NEXT_PUBLIC_SUPABASE_ANON_KEY`, secret key in `SUPABASE_SERVICE_ROLE_KEY`).
4. `npm run dev`, then open http://localhost:3000/health.
5. `npm run typecheck` and `npm run lint`.

## Database

Paste each file from `supabase/migrations/` into the Supabase SQL Editor, in order:
`001` to `006`, then `007` to check. Details are in the comments at the top of each file.

## Rules to keep

- Never commit `.env`. Secret keys are server-only.
- No Google Maps API of any kind. Places are typed by hand (`src/lib/validation/maps-url.ts`).
- No sign-up page or code path.
- Every visible string goes in `src/lib/text/en.ts`.
