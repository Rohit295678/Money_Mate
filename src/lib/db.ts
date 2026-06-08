import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

// Build a pg.Pool tuned for Neon free-tier behaviour:
// - Compute auto-suspends after ~5 min idle; cold start adds 5-15s.
// - connectionTimeoutMillis: 30s allows for cold start without ETIMEDOUT.
// - idleTimeoutMillis: drop idle clients quickly so Neon can recycle them.
// - keepAlive avoids stale TCP connections after long idle periods.
function buildPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 30_000,
    keepAlive: true,
    ssl: { rejectUnauthorized: false },
  });
}

function buildClient(): PrismaClient {
  const pool = global.__pgPool ?? buildPool();
  if (process.env.NODE_ENV !== "production") global.__pgPool = pool;

  const adapter = new PrismaPg(pool, {
    onPoolError: (err) => console.error("[pg.Pool] error:", err.message),
    onConnectionError: (err) =>
      console.error("[pg.Connection] error:", err.message),
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma: PrismaClient = global.__prisma ?? buildClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
