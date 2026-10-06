// Password hashing. Production design specifies argon2id (AUTH-003); this demo build uses Node's built-in
// scrypt (memory-hard, no native addon) so it runs on any serverless runtime without extra binaries.
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const N = 16384, r = 8, p = 1, KEYLEN = 32;

export function hashPassword(password: string, salt = randomBytes(16)): string {
  const hash = scryptSync(password, salt, KEYLEN, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, rr, pp, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n), r: Number(rr), p: Number(pp),
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Runs a hash anyway so that unknown-email logins take the same time as wrong-password logins (SEC-009). */
export function dummyVerify(password: string) {
  verifyPassword(password, DUMMY);
}
const DUMMY = hashPassword("dummy-password-for-timing", Buffer.alloc(16, 7));

export function passwordIssues(password: string, email: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 128) return "Use at most 128 characters.";
  const local = email.split("@")[0]?.toLowerCase();
  if (local && local.length >= 3 && password.toLowerCase().includes(local)) return "Don't include your email name in the password.";
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) return "Mix at least three of: lowercase, uppercase, digits, symbols.";
  if (/^(.)\1+$/.test(password) || /password|123456|qwerty/i.test(password)) return "This password is too common.";
  return null;
}
