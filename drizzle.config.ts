import { defineConfig } from 'drizzle-kit';

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  schema: './src/core/database/drizzle/schema/index.ts',
  out: './src/core/database/drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
});
