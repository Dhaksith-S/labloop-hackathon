import path from "node:path";
import { openDatabase } from "../src/lib/database";
import { seedDemoDatabase } from "../src/lib/demo/seed";

async function main() {
  const dbPath = process.env.LABLOOP_DB_PATH ?? "data/labloop.db";
  const db = openDatabase(dbPath, { quiet: true });
  const profileCount = (
    db.prepare("SELECT COUNT(*) AS count FROM profiles").get() as { count: number }
  ).count;

  let seedMessage = "Existing data preserved; seed not required.";
  if (profileCount === 0 && process.env.LABLOOP_SEED_DEMO !== "0") {
    const result = await seedDemoDatabase(db);
    seedMessage = result.message;
  }

  const counts = {
    resources: (db.prepare("SELECT COUNT(*) AS c FROM resources").get() as { c: number }).c,
    bookings: (db.prepare("SELECT COUNT(*) AS c FROM bookings").get() as { c: number }).c,
    profiles: (db.prepare("SELECT COUNT(*) AS c FROM profiles").get() as { c: number }).c,
  };
  db.close();

  console.log(`LabLoop database ready: ${path.resolve(dbPath)}`);
  console.log(`Profiles: ${counts.profiles} · Resources: ${counts.resources} · Bookings: ${counts.bookings}`);
  console.log(seedMessage);
}

main().catch((error) => {
  console.error("Database setup failed:", error);
  process.exit(1);
});
