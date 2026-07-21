// Ponder's own API surface (SQL-over-HTTP + GraphQL), served on the indexer's
// port (default 42069). The real product API lives in apps/api and reads the
// same Postgres tables directly — this file only satisfies Ponder's build
// requirement and gives direct DB access for local debugging.
import { Hono } from "hono";
import { client, graphql } from "ponder";
import { db } from "ponder:api";
import schema from "ponder:schema";

const app = new Hono();

app.use("/sql/*", client({ db, schema }));
app.use("/graphql", graphql({ db, schema }));
app.use("/", graphql({ db, schema }));

export default app;
