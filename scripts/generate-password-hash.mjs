import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];

if (!password) {
  console.error("Usage: npm run auth:hash -- \"your-password\"");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
const secret = randomBytes(32).toString("hex");

console.log(`AUTH_PASSWORD_HASH=s1:${salt}:${hash}`);
console.log(`AUTH_SESSION_SECRET=${secret}`);
console.log("AUTH_SESSION_TTL_SECONDS=43200");
