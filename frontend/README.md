# The Maintainer Atelier - Frontend

Welcome to the frontend application for **The Maintainer Atelier** — a modern Single Page Application (SPA) designed to manage and streamline open-source contributor journeys.

This frontend provides a clean, responsive, and maintainable user experience for onboarding, learning, tracking progress, and engaging with the community.

---

## Tech Stack

- **Framework:** React 19
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Routing:** React Router v7
- **State / Data Fetching:** TanStack Query (React Query)
- **Testing:** Vitest + React Testing Library

---

## Project Structure

The `src/` directory is organized by responsibility to keep the codebase scalable and easy to maintain.

### `src/app`

Application bootstrap and routing setup.

- `App.tsx` — wraps the app with shared providers such as `QueryClientProvider` and `BrowserRouter`
- `router.tsx` — defines the application routes

### `src/components`

Reusable UI and layout components.

#### `src/components/layout`

Shared structure and navigation components.

- `AppLayout.tsx` — main application shell and layout wrapper
- `Navigation.tsx` — sidebar and top navigation system

#### `src/components/ui`

Reusable presentational components used across pages.

- `SectionCard.tsx` — consistent content card component
- `TerminalPanel.tsx` — command verification / lesson interaction panel

### `src/features`

Feature-specific logic, state, and UI.

#### `src/features/auth`

Authentication-related logic and interface components.

- `AuthContext.tsx` — stores auth state, login/logout helpers, and user lookup logic
- `AuthPageShell.tsx` — shared layout for login and signup pages

### `src/pages`

Route-level pages rendered by the router.

- `LandingPage.tsx`
- `DashboardPage.tsx`
- `LessonPage.tsx`
- `ChallengePage.tsx`
- `CommunityPage.tsx`
- `LoginPage.tsx`
- `SignupPage.tsx`

### `src/lib`

Shared utilities, API helpers, and static data.

- `api.ts` — API client for backend requests
- `data.ts` — static demo content used across the app

### `src/test`

Test setup and test files.

- `App.test.tsx` — React Testing Library test examples
- `setup.ts` — Vitest test environment setup

---

## How the App is Structured

- `main.tsx` mounts the React application
- `App.tsx` configures global providers such as React Query and routing
- `router.tsx` defines all application routes
- `AppLayout.tsx` provides the shared shell for protected and public pages

---

## Features

- Modern React-based SPA architecture
- Organized feature-based folder structure
- Centralized API layer with token handling
- Reusable layout and UI components
- Authentication flow support
- Responsive UI built with Tailwind CSS
- Unit and component testing with Vitest and Testing Library

---

## Environment Variables

Create a `.env` file based on `.env.example`.

```bash
VITE_API_BASE_URL=http://localhost:8000/api
```

If this variable is not set, the app falls back to:

```bash
http://localhost:8000/api
```

---

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Development Server

```bash
npm run dev
```

The app will be available at:

```bash
http://localhost:5173
```

---

## Available Scripts

From the frontend directory:

- `npm run dev` — starts the Vite development server
- `npm run build` — runs TypeScript checks and creates a production build
- `npm run preview` — previews the production build locally
- `npm run lint` — runs ESLint
- `npm run format` — formats the code with Prettier
- `npm run test` — runs Vitest in CI mode

---

## Testing

This project uses **Vitest** with the **jsdom** environment.

Run tests:

```bash
npm run test
```

For interactive debugging in watch mode:

```bash
npx vitest
```

When adding new tests, place them either:

- inside `src/test/`, or
- alongside the component being tested using `.test.tsx`

The project uses **React Testing Library** for rendering and DOM interaction assertions.

---

## Styling and UI

- Tailwind CSS is used for all styling
- Custom colors, fonts, and shadows are defined in `tailwind.config.ts`
- Global styles live in `src/styles.css`

Follow the existing design system when introducing new UI elements.

---

## API Layer

`src/lib/api.ts` handles API requests and automatically attaches the access token when required.

The authentication flow stores tokens in `localStorage` and uses the API client to fetch the current user.

---

## Notes for Contributors

- Add reusable UI in `src/components/ui`
- Add shared layout and navigation components in `src/components/layout`
- Keep auth-specific logic inside `src/features/auth`
- Place route-level screens in `src/pages`
- Keep API utilities and shared static data in `src/lib`
- Follow the existing Tailwind-based design language
- Write tests for new UI and logic where appropriate

---

## Before Opening a Pull Request

Make sure the project passes all checks:

```bash
npm run lint
npm run test
npm run build
```

---
