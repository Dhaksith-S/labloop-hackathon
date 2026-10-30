import { openDatabase } from "../src/lib/database";
import { seedDemoDatabase } from "../src/lib/demo/seed";

async function main() {
  const dbPath = process.env.LABLOOP_DB_PATH ?? "data/labloop.db";
  const db = openDatabase(dbPath, { quiet: true });
  const result = await seedDemoDatabase(db);
  db.close();
  console.log(result.message);
}

main().catch((error) => {
  console.error("Demo seed failed:", error);
  process.exit(1);
});
