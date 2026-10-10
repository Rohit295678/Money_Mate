-- Manual migration for push notifications + in-app notification inbox.
-- Run with `npm run db:push`, or paste this SQL into Neon's console.
-- Purely additive: two new tables, no changes to existing ones.

CREATE TABLE IF NOT EXISTS "push_tokens" (
  "id"         TEXT PRIMARY KEY,
  "user_id"    TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token"      TEXT NOT NULL,
  "platform"   TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "push_tokens_token_key" ON "push_tokens"("token");
CREATE INDEX IF NOT EXISTS "push_tokens_user_id_idx" ON "push_tokens"("user_id");

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"         TEXT PRIMARY KEY,
  "user_id"    TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"       TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "group_id"   TEXT,
  "read"       BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "notifications_user_id_read_created_at_idx"
  ON "notifications"("user_id", "read", "created_at");
