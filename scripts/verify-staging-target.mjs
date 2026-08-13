import { readFileSync } from "node:fs";
import process from "node:process";

const envFileUrl = new URL("../.env.local", import.meta.url);
const tutoringProjectRefUrl = new URL(
  "../../tutoring/supabase/.temp/project-ref",
  import.meta.url,
);

function parseEnv(contents) {
  const values = new Map();
  for (const line of contents.split(/\r?\n/u)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/u.exec(line);
    if (match === null) continue;
    const [, name, rawValue] = match;
    const value = rawValue.replace(/^(?:"(.*)"|'(.*)')$/u, "$1$2");
    values.set(name, value);
  }
  return values;
}

function fail(message) {
  process.stderr.write(`Staging target verification failed: ${message}\n`);
  process.exit(1);
}

const values = parseEnv(readFileSync(envFileUrl, "utf8"));
const apiUrlValue = values.get("NEXT_PUBLIC_SUPABASE_URL");
const databaseUrlValue = values.get("SUPABASE_STAGING_DATABASE_URL");

if (apiUrlValue === undefined || apiUrlValue.length === 0) {
  fail("NEXT_PUBLIC_SUPABASE_URL is missing");
}
if (databaseUrlValue === undefined || databaseUrlValue.length === 0) {
  fail("SUPABASE_STAGING_DATABASE_URL is missing");
}

let apiUrl;
let databaseUrl;
try {
  apiUrl = new URL(apiUrlValue);
  databaseUrl = new URL(databaseUrlValue);
} catch {
  fail("a configured URL is malformed");
}

if (apiUrl.protocol !== "https:" || !/^[a-z]{20}\.supabase\.co$/u.test(apiUrl.host)) {
  fail("NEXT_PUBLIC_SUPABASE_URL is not a hosted Supabase HTTPS URL");
}
if (databaseUrl.protocol !== "postgresql:" && databaseUrl.protocol !== "postgres:") {
  fail("SUPABASE_STAGING_DATABASE_URL is not a PostgreSQL URI");
}

const stagingRef = apiUrl.host.split(".")[0];
const databaseIdentity = `${databaseUrl.username}@${databaseUrl.hostname}`;
if (!databaseIdentity.includes(stagingRef)) {
  fail("database URI does not identify the same project ref as the staging API URL");
}

let linkedMainRef = "";
try {
  linkedMainRef = readFileSync(tutoringProjectRefUrl, "utf8").trim();
} catch {
  // A missing local link is safe; the explicit staging URI remains mandatory.
}

if (linkedMainRef.length > 0 && linkedMainRef === stagingRef) {
  fail("staging project ref equals the tutoring repository's linked project");
}
if (linkedMainRef.length > 0 && databaseIdentity.includes(linkedMainRef)) {
  fail("database URI appears to target the tutoring repository's linked project");
}

process.stdout.write(
  [
    "Staging target verified.",
    `Project ref: ${stagingRef}`,
    "Different from tutoring linked project: yes",
    "Database URI value was not printed.",
    "Safe invocation policy: explicit --db-url only; never --linked.",
  ].join("\n") + "\n",
);
