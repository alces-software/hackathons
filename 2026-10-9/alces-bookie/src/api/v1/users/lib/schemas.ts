import { z } from '@hono/zod-openapi';

/**
 * User schema
 */
export const UserReturnSchema = z.object({
   id: z.int(),
   username: z.string(),
   balance: z.number(),
   debt: z.number(),
   winnings: z.number(),
   loses: z.number()
});
