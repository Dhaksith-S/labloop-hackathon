import path from "node:path";

export function validateProductionEnvironment(env: Record<string, string | undefined>): void {
  if (!env.LABLOOP_SESSION_SECRET || env.LABLOOP_SESSION_SECRET.length < 24) {
    throw new Error("LABLOOP_SESSION_SECRET must contain at least 24 characters.");
  }
  if (!env.LABLOOP_DB_PATH || !path.isAbsolute(env.LABLOOP_DB_PATH) ||
      !env.LABLOOP_DB_PATH.endsWith(".db")) {
    throw new Error("Set LABLOOP_DB_PATH to an absolute .db path on the mounted persistent volume.");
  }
  if (env.LABLOOP_INSECURE_COOKIES === "1") {
    throw new Error("Production hosting requires Secure cookies; remove LABLOOP_INSECURE_COOKIES=1.");
  }
  const url = new URL(env.NEXT_PUBLIC_APP_URL ?? "");
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("NEXT_PUBLIC_APP_URL must be the real HTTPS application URL.");
  }
  if (!["0", "1"].includes(env.LABLOOP_SEED_DEMO ?? "")) {
    throw new Error("Set LABLOOP_SEED_DEMO explicitly: 1 for a fictional demo, 0 for an initialized non-demo store.");
  }
}
