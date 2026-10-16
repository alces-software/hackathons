import { z } from '@hono/zod-openapi';

/**
 * Transaction schema
 */
export const TransactionReturnSchema = z.object({
   id: z.int(),
   sender: z.string().nullable(),
   receiver: z.string().nullable(),
   createdAt: z.date(),
   service: z.object({
      id: z.int().nullable(),
      name: z.string().nullable()
   })
});
