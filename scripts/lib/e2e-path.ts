import path from "node:path";

export const E2E_DB_PATH = "data/e2e.db";

/** The reset target must match the server target; arbitrary .db paths are unsafe. */
export function resolveE2eDatabasePath(
  configured = process.env.LABLOOP_DB_PATH,
  nodeEnv = process.env.NODE_ENV,
): string {
  if (nodeEnv === "production") throw new Error("E2E preparation is disabled in production.");
  const resolved = path.resolve(configured ?? E2E_DB_PATH);
  if (resolved !== path.resolve(E2E_DB_PATH)) {
    throw new Error(`Refusing to reset any database other than ${E2E_DB_PATH}.`);
  }
  return resolved;
}
