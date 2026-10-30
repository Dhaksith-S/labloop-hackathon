import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/** SQLite Online Backup includes committed WAL content; never copy a live .db alone. */
export async function backupDatabase(source: string, destination: string): Promise<void> {
  const resolvedSource = path.resolve(source);
  const resolvedDestination = path.resolve(destination);
  if (!resolvedSource.endsWith(".db") || !resolvedDestination.endsWith(".db") ||
      resolvedSource === resolvedDestination) {
    throw new Error("Source and destination must be different .db paths.");
  }
  if (!fs.statSync(resolvedSource).isFile()) throw new Error("Source must be an existing database file.");
  fs.mkdirSync(path.dirname(resolvedDestination), { recursive: true });
  // Exclusive creation prevents accidentally overwriting any existing database.
  fs.closeSync(fs.openSync(resolvedDestination, "wx", 0o600));
  const sourceDb = new Database(resolvedSource, { readonly: true, fileMustExist: true });
  try {
    await sourceDb.backup(resolvedDestination);
    const copy = new Database(resolvedDestination, { readonly: true });
    try {
      if (copy.pragma("integrity_check", { simple: true }) !== "ok") {
        throw new Error("Backup integrity check failed; do not use this copy.");
      }
    } finally { copy.close(); }
  } finally { sourceDb.close(); }
}
