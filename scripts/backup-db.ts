import { backupDatabase } from "./lib/backup";

const destination = process.argv[2];
if (!destination) throw new Error("Usage: npm run db:backup -- <new-backup-path.db>");
backupDatabase(process.env.LABLOOP_DB_PATH ?? "data/labloop.db", destination)
  .then(() => console.log(`Verified SQLite backup created: ${destination}`))
  .catch(error => { console.error(error); process.exitCode = 1; });
