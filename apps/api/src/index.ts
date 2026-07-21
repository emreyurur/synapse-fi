// API server entrypoint: wires the real repo + chain reader, serves the Hono
// app, and (optionally) starts the oracle worker cron in-process.

import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createRepo } from "./repo.js";
import { readPoolState } from "./chain.js";
import { getDb } from "./db.js";
import { config } from "./config.js";
import { startOracleWorker } from "./oracle/index.js";

const repo = createRepo();
const app = createApp({ repo, readPool: readPoolState });

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
  console.log(`[api] database: ${getDb() ? "connected" : "not configured (empty responses)"}`);
});

if (config.oracleEnabled) {
  startOracleWorker();
} else {
  console.log("[api] oracle worker disabled (set ORACLE_ENABLED=true to run epochs in-process)");
}
