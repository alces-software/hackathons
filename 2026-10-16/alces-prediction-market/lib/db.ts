import mariadb, { type Pool } from "mariadb";

const globalForDb = globalThis as unknown as {
  alcesPool?: Pool;
};

export function getDbPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!globalForDb.alcesPool) {
    globalForDb.alcesPool = mariadb.createPool(process.env.DATABASE_URL);
  }

  return globalForDb.alcesPool;
}
