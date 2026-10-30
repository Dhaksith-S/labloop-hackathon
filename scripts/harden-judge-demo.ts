import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { lockPrivilegedDemoAccounts } from "./lib/judge-accounts";

async function main() {
  if (!process.env.LOCALAPPDATA) throw new Error("Windows private judge runtime is required.");
  const runtime = path.join(process.env.LOCALAPPDATA, "LabLoop/judge-demo");
  const profile = JSON.parse(fs.readFileSync(path.join(runtime, "profile.json"), "utf8").replace(/^\uFEFF/, "")) as { dbPath: string };
  const expected = path.resolve(runtime, "fictional-judge.db");
  if (path.resolve(profile.dbPath).toLowerCase() !== expected.toLowerCase()) throw new Error("Refusing to harden any store except the isolated fictional judge database.");
  const db = new Database(expected, { fileMustExist: true });
  try {
    const result = await lockPrivilegedDemoAccounts(db);
    const evidence = path.join(runtime, "judge-privileged-accounts.json");
    if (result.credentialsLocked || result.sessionsRevoked || !fs.existsSync(evidence)) {
      fs.writeFileSync(evidence, JSON.stringify({ at: new Date().toISOString(), ...result,
        scope: "isolated fictional public judge DB only", passwordRetained: false }, null, 2));
    }
    console.log(`Public judge hardening: ${result.credentialsLocked} privileged shared credentials locked; ${result.sessionsRevoked} privileged sessions revoked. Student/owner accounts and history preserved.`);
  } finally { db.close(); }
}
main().catch(() => { console.error("Judge account hardening failed; inspect the isolated store privately before exposure."); process.exitCode = 1; });
