<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may
all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent rules

`ARCHITECTURE.md` is the canonical reference. The rules below are mandatory.
Do not change the project structure unless explicitly approved.

## Stack
- Next.js 16 (App Router) + React 19 + React Compiler (`reactCompiler: true`)
- TypeScript strict — code MUST pass `tsc --noEmit` and `next build`
- Tailwind CSS v4, design tokens via `@theme`
- next-themes (light/dark) · i18next + react-i18next · dayjs
- Package manager: **Bun**
- Import alias: `@/*` → `./src/*`

## Where code goes
- `app/` — route files only, keep them thin. A page/layout just imports from a
  section and renders it. No business logic, no UI here.
- `sections/<feature>/` — feature implementation: `view/<feature>-view.tsx`,
  `layout/`, `const.tsx` (static data), `index.ts` (barrel exporting the View).
- `components/<category>/` — reusable UI across features (PascalCase files).
- `contexts/` — React providers · `configs/` — app constants (`route.ts`,
  `endpoint.ts`) · `hooks/` — shared hooks · `lib/` — business logic/helpers ·
  `types/` — shared types · `languages/` — i18n · `material/` — fonts.

## Server vs Client
- Server Components by default. Add `"use client"` ONLY when a file needs hooks,
  event handlers, or browser APIs.
- Fetch-on-render → call an `lib/api` service directly inside a Server Component
  section. Use a `hooks/` hook only for client-side interaction/state.

## API layer
- `lib/api` is the ONLY place that talks to the backend. Never `fetch` directly
  inside a component/section.
- All endpoint paths come from `configs/endpoint.ts` — no hardcoded URL strings.
- Every request/response is typed in `types/`.
- Pattern per resource: add path in `endpoint.ts` → service in
  `lib/api/<resource>.ts` → type in `types/<resource>.ts`.

## Styling / design tokens
- `app/globals.css` is the single source of truth for color (`@theme` + `:root`
  + `.dark`). Token name = `{category}-{intent}-{state}`.
- Use token utilities only: `bg-*`, `text-*`, `border-*`
  (e.g. `bg-background-primary-default`).
- NEVER hardcode hex (`bg-[#0C0D0D]`) or put `hsla(var(--token))` in components.
  New color = add a token in all three layers, not a raw value at the call site.
- Design every UI state: default / hover / focus / active / disabled / loading /
  empty / error. Meet WCAG AA, use semantic HTML, support keyboard, respect
  `prefers-reduced-motion`.

## Imports
- Alias imports only: `import { Button } from "@/components/actionable/Buttons"`.
- No relative imports across folders (`../../../...`).

## i18n
- Text lives in `languages/project/{th,en}.json` (keep both in sync).
- Use the typed `t()` — keys are validated at build time from `th.json`.
- `defaultNS` / `ns` are `"translation"` in both `index.tsx` and `types.ts`.

## Naming
- Folders: lowercase / kebab-case.
- Reusable components in `components/`: PascalCase. Other source files (sections,
  lib, hooks, configs): kebab-case. Feature view: `<feature>-view.tsx`.

## Before finishing
- Run `bun run typecheck` (`tsc --noEmit`) and `bun run build`; both must pass.
- Do NOT add dependencies, frameworks, or libraries without approval.
- Small change → return only modified files. Large feature → full file tree.
