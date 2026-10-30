import fs from "node:fs";
import path from "node:path";
import { openDatabase } from "../src/lib/database";
import { seedDemoDatabase } from "../src/lib/demo/seed";

async function main() {
  const dbPath = process.env.LABLOOP_DB_PATH ?? "data/labloop.db";
  const resolved = path.resolve(dbPath);
  if (!resolved.endsWith(".db")) {
    throw new Error("Refusing to reset a path that does not end in .db");
  }
  for (const suffix of ["", "-wal", "-shm"]) {
    const candidate = `${resolved}${suffix}`;
    if (fs.existsSync(candidate)) fs.rmSync(candidate);
  }
  const db = openDatabase(dbPath, { quiet: true });
  const result = await seedDemoDatabase(db);
  db.close();
  console.log(`Reset complete: ${resolved}`);
  console.log(result.message);
}

main().catch((error) => {
  console.error("Database reset failed:", error);
  process.exit(1);
});
