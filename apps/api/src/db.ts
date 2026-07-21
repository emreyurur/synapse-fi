// Drizzle connection to the Postgres database that the Ponder indexer writes.
// The API reads the very same tables (imported from @synapsefi/indexer/schema),
// so there is a single schema source of truth across the backend.

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "@synapsefi/indexer/schema";
import { config } from "./config.js";

export type Database = NodePgDatabase<typeof schema>;

let pool: pg.Pool | null = null;
let db: Database | null = null;

/** Returns the shared Drizzle db, or null when DATABASE_URL is not configured. */
export function getDb(): Database | null {
  if (!config.databaseUrl) return null;
  if (db) return db;
  pool = new pg.Pool({
    connectionString: config.databaseUrl,
    // Ponder writes into `config.databaseSchema`; align the session search_path.
    options: `-c search_path=${config.databaseSchema}`,
  });
  // Ponder's own tables are camelCase-keyed but snake_case in Postgres
  // (it builds its internal drizzle client with the same option).
  db = drizzle(pool, { schema, casing: "snake_case" });
  return db;
}

/** Liveness check used by the /health endpoint. */
export async function pingDb(): Promise<boolean> {
  const d = getDb();
  if (!d) return false;
  try {
    await d.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
  db = null;
}

export { schema };
