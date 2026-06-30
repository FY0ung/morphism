# Web App Template

Central project structure. Every new project must follow this layout and the
conventions in `ARCHITECTURE.md`.

## Stack
- Next.js 16 (App Router) + React 19 + React Compiler
- TypeScript (strict, `tsc --noEmit`)
- Tailwind CSS v4 (design tokens via `@theme`)
- next-themes (light/dark), i18next + react-i18next, dayjs
- Package manager: **Bun**

## Getting started
```bash
bun install
bun run dev        # http://localhost:3000
bun run typecheck  # tsc --noEmit
bun run build      # next build
bun run lint
```

## What to change per project
- `package.json` name, `src/app/layout.tsx` metadata
- `src/material/fonts/*` to rebrand the font (keep the `--font-font` variable)
- `src/app/globals.css` token values under `:root` / `.dark`
- Build features under `src/sections/<feature>/`
