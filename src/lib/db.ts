import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const isLocal =
  url.includes("localhost") || url.includes("127.0.0.1");

export const db = postgres(url, {
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
