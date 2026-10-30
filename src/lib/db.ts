import "server-only";

import type { Db } from "./database";
import { openDatabase } from "./database";

export type { Db } from "./database";
export { openDatabase } from "./database";

declare global {
  // eslint-disable-next-line no-var
  var __labloopDb: Db | undefined;
}

/** Process-wide connection used by server components and server actions. */
export function getDb(): Db {
  if (!globalThis.__labloopDb) {
    globalThis.__labloopDb = openDatabase();
  }
  return globalThis.__labloopDb;
}

export function closeDbForTests(): void {
  globalThis.__labloopDb?.close();
  globalThis.__labloopDb = undefined;
}
