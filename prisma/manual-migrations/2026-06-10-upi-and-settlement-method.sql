-- Manual migration for the UPI feature.
-- Run with `npm run db:push` (Prisma will apply the schema changes to Neon),
-- or copy/paste this SQL directly into Neon's console.
-- Both columns are nullable so existing rows are valid without backfill.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "upi_id" TEXT;

ALTER TABLE "settlements"
  ADD COLUMN IF NOT EXISTS "method" TEXT,
  ADD COLUMN IF NOT EXISTS "txn_ref" TEXT;
