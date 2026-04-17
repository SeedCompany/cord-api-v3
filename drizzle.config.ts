import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/core/database/drizzle/schema.ts',
  out: './src/core/database/drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
});
