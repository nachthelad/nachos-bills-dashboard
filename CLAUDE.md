# CLAUDE.md — TOLVA

## Project

Finance tracker PWA built with Next.js 16, React 19, Tailwind CSS 4, Radix UI (shadcn), Firebase, and TypeScript.

## Workflow

- **Never use git worktrees.** Work directly on a new branch in the main repo.
- Branch naming: `feat/<description>`, `fix/<description>`, `chore/<description>`
- Commit using Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, etc.
- PRs always target `main`.

## Stack

- **Framework:** Next.js 16 (App Router, `app/` directory)
- **Auth:** Firebase Auth + server-side cookie verification (`lib/server/require-auth.ts`)
- **Database:** Firestore via Firebase
- **Styling:** Tailwind CSS 4 + shadcn/ui components (`components/ui/`)
- **Icons:** Lucide React
- **Forms:** React Hook Form + Zod
- **Charts:** Recharts

## Structure

```
app/
  (secure)/       # Protected routes — layout wraps with SidebarProvider + BottomNav
  auth/           # Public auth routes (login)
  api/            # API routes
components/
  ui/             # shadcn/ui primitives
  app-sidebar.tsx # Desktop sidebar navigation
  bottom-nav.tsx  # Mobile bottom navigation (lg:hidden)
lib/
  auth-context.tsx
  server/require-auth.ts
hooks/
  use-mobile.ts   # 768px breakpoint
```

## Navigation

- **Desktop (≥ 1024px):** Left sidebar (`AppSidebar`) with collapsible icon mode.
- **Mobile (< 1024px):** Fixed bottom navigation bar (`BottomNav`), sidebar is hidden.
- Nav items: Dashboard `/dashboard`, Bills `/documents`, Income `/income`, Expenses `/expenses`, HOA `/hoa`, Settings `/settings`

## Code conventions

- All client components require `"use client"` directive.
- Use `cn()` from `@/lib/utils` for conditional class merging.
- Prefer editing existing files over creating new ones.
- Do not add unnecessary comments or docstrings.
- Avoid over-engineering — keep solutions minimal and focused.
