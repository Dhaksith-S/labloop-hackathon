import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type Db = Database.Database;

const SCHEMA_PATH = path.join(process.cwd(), "src", "db", "sqlite-schema.sql");

export interface OpenDatabaseOptions {
  /** Silence SQLite's default console warnings in tests. */
  quiet?: boolean;
}

/**
 * Open (and migrate) a SQLite database. Used by the app singleton, seed
 * scripts and integration tests. Contains no Next.js-only imports.
 */
export function openDatabase(
  filename = process.env.LABLOOP_DB_PATH ?? "data/labloop.db",
  options: OpenDatabaseOptions = {},
): Db {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }

  const db = new Database(filename);
  if (!options.quiet) db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  if (filename !== ":memory:") {
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
  }

  const schemaSql = fs.readFileSync(SCHEMA_PATH, "utf8");
  db.exec(schemaSql);
  return db;
}
