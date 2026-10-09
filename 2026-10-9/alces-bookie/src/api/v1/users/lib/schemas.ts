import { z } from '@hono/zod-openapi';

/**
 * User schema
 */
export const UserReturnSchema = z.object({
   username: z.string(),
   balance: z.number()
});
