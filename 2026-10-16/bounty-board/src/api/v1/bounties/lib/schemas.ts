import { z } from '@hono/zod-openapi';

export const bountyReturnSchema = z.object({
   id: z.int(),
   patron: z.string(),
   claiment: z.string().nullable(),
   price: z.number(),
   title: z.string(),
   description: z.string().nullable(),
   startDate: z.date(),
   endDate: z.date().nullable()
});

export type Bounty = z.infer<typeof bountyReturnSchema>;
