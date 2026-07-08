// Drizzle client for server-side queries (Server Components / Server Actions).
// Uses the pooled Supabase connection; `prepare: false` is required for the
// transaction pooler (pgBouncer).
//
// The client is created lazily (on first query, at request time) via a Proxy so
// that merely importing `@/db` has no side effects. Otherwise `postgres()` parses
// DATABASE_URL at module load, which crashes Next's build step ("Collecting page
// data") when the build environment lacks a valid URL — even though the build
// never needs the database.

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let cached: PostgresJsDatabase<typeof schema> | undefined;

function init(): PostgresJsDatabase<typeof schema> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida (ver .env.local.example)");
  }
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    cached ??= init();
    const value = Reflect.get(cached, prop, cached);
    return typeof value === "function" ? value.bind(cached) : value;
  },
});
