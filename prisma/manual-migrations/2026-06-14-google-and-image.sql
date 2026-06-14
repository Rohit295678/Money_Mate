-- Manual migration for Google Sign-In + profile pictures.
-- Run with `npm run db:push` (Prisma will apply the schema changes), or
-- copy/paste this SQL directly into Neon's console.

-- Make the password column nullable so Google-only users can register
-- without one. Existing rows are preserved.
ALTER TABLE "users"
  ALTER COLUMN "password" DROP NOT NULL;

-- Add Google's stable user identifier and cached profile image.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "google_id" TEXT,
  ADD COLUMN IF NOT EXISTS "image" TEXT;

-- Unique constraint so we never end up with two users tied to the same
-- Google account. Skipped if it already exists.
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_key"
  ON "users"("google_id");
