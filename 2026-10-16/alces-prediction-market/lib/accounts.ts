import crypto from "crypto";
import { getDbPool } from "@/lib/db";
import { getBookieUser, serviceTransaction } from "@/lib/bookie";

export type AlcesUser = {
  id: number;
  displayName: string;
  mooseBucks: number;
  bookieUsername: string | null;
};

export class AccountError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function getAlcesUser(userId: number): Promise<AlcesUser> {
  const connection = await getDbPool().getConnection();
  try {
    const rows = await connection.query(
      "SELECT id, display_name, moose_bucks, bookie_username FROM users WHERE id = ?",
      [userId],
    ) as Array<{ id: number; display_name: string; moose_bucks: number; bookie_username: string | null }>;
    const row = rows[0];
    if (!row) throw new AccountError("Alces user not found.", 404);
    return {
      id: row.id,
      displayName: row.display_name,
      mooseBucks: Number(row.moose_bucks),
      bookieUsername: row.bookie_username,
    };
  } finally {
    connection.release();
  }
}

export type BookieCredentials = { username: string; password: string };

/**
 * Returns the linked bookie credentials. The password is stored AES-256-GCM
 * encrypted (written by /api/auth/link-bookie) because the bookie API needs
 * the plaintext on every service transaction.
 */
export async function getBookieCredentials(userId: number): Promise<BookieCredentials> {
  const connection = await getDbPool().getConnection();
  try {
    const rows = await connection.query(
      "SELECT bookie_username, bookie_password_hash FROM users WHERE id = ?",
      [userId],
    ) as Array<{ bookie_username: string | null; bookie_password_hash: string | null }>;
    const row = rows[0];
    if (!row) throw new AccountError("Alces user not found.", 404);
    if (!row.bookie_username || !row.bookie_password_hash) {
      throw new AccountError("Link your bookie account first to trade with moose bucks.", 409);
    }
    return { username: row.bookie_username, password: decryptBookiePassword(row.bookie_password_hash) };
  } finally {
    connection.release();
  }
}

export function encryptBookiePassword(password: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", cipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${encrypted.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
}

function decryptBookiePassword(stored: string): string {
  const [ivPart, dataPart, tagPart] = stored.split(".");
  if (!ivPart || !dataPart || !tagPart) {
    throw new AccountError("Stored bookie credentials are unreadable. Re-link your bookie account.", 409);
  }
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", cipherKey(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new AccountError("Stored bookie credentials failed to decrypt. Re-link your bookie account.", 409);
  }
}

function cipherKey(): Buffer {
  return crypto.createHash("sha256").update(process.env.SESSION_SECRET ?? "").digest();
}

export async function syncBalanceFromBookie(userId: number): Promise<number> {
  const user = await getAlcesUser(userId);
  if (!user.bookieUsername) throw new AccountError("No bookie account linked.", 409);
  const bookie = await getBookieUser(user.bookieUsername);
  const connection = await getDbPool().getConnection();
  try {
    await connection.query("UPDATE users SET moose_bucks = ? WHERE id = ?", [bookie.balance, userId]);
  } finally {
    connection.release();
  }
  return bookie.balance;
}

export async function pushBalanceToBookie(userId: number, amount: number): Promise<number> {
  const delta = Number(amount.toFixed(2));
  if (delta === 0) return 0;
  const credentials = await getBookieCredentials(userId);
  const type = delta > 0 ? "win" : "loss";
  const result = await serviceTransaction(credentials.username, credentials.password, type, Math.abs(delta));
  return result.id;
}