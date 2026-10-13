import { z } from '@hono/zod-openapi';

/**
 * Service schema
 */
export const ServiceReturnSchema = z.object({
   id: z.int(),
   name: z.string(),
   balance: z.number()
});
