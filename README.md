# MoneyMate

A personal finance web app built with Next.js 16, TypeScript, Tailwind CSS, and SQLite.

## Features

- **Expense Tracker** — log and categorize spending with custom categories
- **Budget Planner** — set monthly limits per category with progress tracking
- **Bill Splitter** — split bills among friends with automatic settle-up calculation
- **Savings Goals** — set targets, track contributions, visualize progress
- **Debt Payoff Planner** — track debts with payment history
- **Charts** — spending breakdown (donut) + budget vs actual (bar) on the overview
- **Multi-currency** — 15 currencies, persisted to localStorage
- **Mobile responsive** — hamburger drawer on small screens

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | SQLite via `better-sqlite3` |
| Auth | NextAuth.js v4 (JWT) |
| Charts | Recharts |

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and register an account.

The SQLite database (`prisma/dev.db`) is created automatically on first run — no migrations needed.

## Environment Variables

Create a `.env` file in the root:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

Generate a strong secret with:
```bash
openssl rand -base64 32
```
