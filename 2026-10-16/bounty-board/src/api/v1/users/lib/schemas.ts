import { z } from '@hono/zod-openapi';

export const userReturnSchema = z.object({
   id: z.int(),
   username: z.string(),
   balance: z.number(),
   debt: z.number(),
   winnings: z.number(),
   losses: z.number()
});

export type User = z.infer<typeof userReturnSchema>;
