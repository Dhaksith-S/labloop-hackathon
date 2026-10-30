import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SCRYPT_KEYLEN = 64;

const DUMMY_HASH =
  "scrypt$pEiTDSAPubSHIwgLLDSAFw$xhP6_P4hGAZ_NaKw2cBcxB0zSufdzaYHln0Ka0T7cgf_Vyb4GOr3vRVbicArO3gDF5SNbO7cabZ5kyb5J43lmA";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "base64url");
    const expected = Buffer.from(parts[2], "base64url");
    const derived = await scrypt(password, salt, expected.length);
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Always performs a scrypt derivation, even for unknown accounts. */
export async function verifyPasswordConstantTime(
  password: string,
  stored: string | undefined,
): Promise<boolean> {
  if (!stored) {
    await verifyPassword(password, DUMMY_HASH);
    return false;
  }
  return verifyPassword(password, stored);
}
