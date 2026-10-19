import { z } from '@hono/zod-openapi';

/**
 * Transaction schema
 */
export const TransactionReturnSchema = z.object({
   id: z.int(),
   sender: z.string().nullable(),
   receiver: z.string().nullable(),
   createdAt: z.date(),
   amount: z.number(),
   type: z.enum(["win", "loss", "hold", "return", "transfer"]),
   service: z.object({
      id: z.int().nullable(),
      name: z.string().nullable()
   })
});
