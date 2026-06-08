import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 config. The `url` here is what `prisma migrate` / `prisma db push`
// use, so we point it at DIRECT_URL (the unpooled Neon URL).
// The runtime app connection (DATABASE_URL, pooled) is configured in
// src/lib/db.ts via the @prisma/adapter-pg driver adapter.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
