import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_HEX = process.env.ENCRYPTION_KEY;

if (!KEY_HEX) {
  throw new Error("ENCRYPTION_KEY environment variable is required");
}

const KEY = Buffer.from(KEY_HEX, "hex"); // 32 bytes

export function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(12); // recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText;
  const buffer = Buffer.from(encryptedText, "base64");

  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted, null, "utf8") + decipher.final("utf8");
}
