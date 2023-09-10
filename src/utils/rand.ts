import crypto from "crypto";

export function randomString(length: number) {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
}
