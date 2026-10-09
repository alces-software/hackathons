import { z } from '@hono/zod-openapi';

/**
 * Transaction schema
 */
export const TransactionReturnSchema = z.object({
   username: z.string(),
   timestamp: z.date(),
   before: z.number(),
   after: z.number(),
   service: z.object({
      id: z.number(),
      name: z.string()
   })
});
