import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lib/db.ts reads db/schema.sql at runtime to create its tables. Next only ships
  // files it can see being imported, and a path built from process.cwd() is not
  // one of them, so without this the file is missing on Vercel and every database
  // call fails. It never showed until production first had a database.
  outputFileTracingIncludes: {
    "/api/events": ["./db/schema.sql"],
    "/api/audio": ["./db/schema.sql"],
    "/api/review": ["./db/schema.sql", "./regions/*.json"],
  },
};

export default nextConfig;
