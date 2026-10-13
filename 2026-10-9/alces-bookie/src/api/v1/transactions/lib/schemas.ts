import { z } from '@hono/zod-openapi';

/**
 * Transaction schema
 */
export const TransactionReturnSchema = z.object({
   id: z.int(),
   username: z.string(),
   timestamp: z.date(),
   before: z.number(),
   after: z.number(),
   service: z.object({
      id: z.int(),
      name: z.string()
   })
});
