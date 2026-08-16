import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Explicitly load .env so Prisma CLI can access DATABASE_URL
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
