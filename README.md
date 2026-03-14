# Installation Reporting Portal

Production-focused React application for managing VEU installation reporting workflows.

## What this app does

- Handles authentication and protected routes for internal users.
- Creates and resumes installation jobs.
- Captures customer, premises, decommissioning, and post-installation details.
- Integrates with Supabase for data storage and workflow persistence.

## Tech stack

- React 19 + React Router
- Create React App (react-scripts)
- Supabase JS client
- ESLint + Prettier for code quality and consistency

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create local environment config:

```bash
cp .env.example .env
```

3. Fill required variables in `.env`:

```env
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=
REACT_APP_GEOSCAPE_API_KEY=
```

4. Run in development:

```bash
npm start
```

## Scripts

- `npm start`: Start local dev server.
- `npm run build`: Build optimized production bundle.
- `npm test`: Run tests in watch mode.
- `npm run test:ci`: Run tests once for CI.
- `npm run lint`: Run ESLint over `src`.
- `npm run lint:fix`: Auto-fix lint issues where possible.
- `npm run format`: Format source files with Prettier.
- `npm run format:check`: Validate formatting in CI.

## Project structure

```text
public/                 Static assets and app shell
src/
	components/           UI screens and feature components
	contexts/             Global React state (auth/form/search)
	relationship/         Supabase integration and data persistence
	utils/                Shared form fields and helpers
	config/               Environment and runtime configuration
	App.js                Route composition
	index.js              App bootstrap
docs/                   Architecture and operational notes
```

## Deployment notes

- This is a static React SPA build output in `build/`.
- Configure hosting for client-side routing fallback to `index.html`.
- Ensure production environment variables are injected at build time.