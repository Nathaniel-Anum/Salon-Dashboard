# React + Vite

## Booking V2 staging development

The Booking V2 interface is capability-gated. To run the frontend locally against
the staging backend:

1. Ensure `.env.development.local` contains:

   ```text
   VITE_API_BASE_URL=https://staging.api.cbkbeauty.expertech.dev
   VITE_WS_BASE_URL=wss://staging.api.cbkbeauty.expertech.dev
   ```

2. Restart `npm run dev` after changing an environment file. Vite reads env files
   only when the dev server starts.
3. Sign in and open `/schedules`. A successful
   `GET /api/portal/v2/booking/capabilities/` renders Schedule Studio; a `404`
   means `BOOKING_V2_PORTAL_ENABLED` is disabled on staging and intentionally keeps
   the V1 scheduler available.

`.env.example` is documentation only and is not loaded by Vite. Copy it to
`.env.development.local` when setting up another machine.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
