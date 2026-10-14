import 'dotenv/config';

import { z } from '@hono/zod-openapi';

const envSchema = z.object({
   // Server
   PORT: z.coerce.number().int().min(1).max(65535).default(3000),

   // Database
   DB_HOST: z.string().default('localhost'),
   DB_NAME: z.string().default('bank'),
   DB_USERNAME: z.string().default('banker'),
   DB_PASSWORD: z.string().default('mypassword'),
   DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),

   // Transaction settings
   USER_TRANSACTION_FEE: z.coerce.number().min(0).max(1).default(0.05),
   SERVICE_TRANSACTION_FEE: z.coerce.number().min(0).max(1).default(0.01),
   DEBT_LIMIT: z.coerce.number().min(0).default(1000),
   LOAN_INTEREST: z.coerce.number().min(0).max(1).default(0.1),
   LOAN_REPAY: z.coerce.number().min(0).max(1).default(0.03),

   // Bank
   BANK_USERNAME: z.string().default('bank')
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
