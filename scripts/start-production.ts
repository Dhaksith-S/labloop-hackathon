import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { validateProductionEnvironment } from "./lib/production-env";

const require = createRequire(import.meta.url);
const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production" };
validateProductionEnvironment(env);

// Run setup only after configuration passes. Existing profiles suppress the seed.
const setup = spawnSync(process.execPath, [require.resolve("tsx/cli"), "scripts/setup-db.ts"], {
  stdio: "inherit", env,
});
if (setup.error) throw setup.error;
if (setup.status !== 0) process.exit(setup.status ?? 1);

const server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start",
  "--hostname", env.LABLOOP_BIND_HOST ?? "0.0.0.0", "--port", env.PORT ?? "3000"], {
  stdio: "inherit", env,
});
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => server.kill(signal));
}
server.on("error", error => { console.error(error); process.exit(1); });
server.on("exit", code => process.exit(code ?? 1));
