import fs from "node:fs";
import { resolveE2eDatabasePath } from "./lib/e2e-path";
import { openDatabase } from "../src/lib/database";
import { seedDemoDatabase } from "../src/lib/demo/seed";

async function main() {
  const resolved = resolveE2eDatabasePath();
  for (const suffix of ["", "-wal", "-shm"]) {
    const candidate = `${resolved}${suffix}`;
    if (fs.existsSync(candidate)) fs.rmSync(candidate);
  }
  const db = openDatabase(resolved, { quiet: true });
  const result = await seedDemoDatabase(db);
  db.close();
  console.log(`E2E database prepared at ${resolved}`);
  console.log(result.message);
}

main().catch((error) => {
  console.error("E2E database preparation failed:", error);
  process.exit(1);
});
