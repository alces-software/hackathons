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

export const loginRequestSchema = z.object({
   username: z.string(),
   password: z.string()
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginReturnSchema = z.object({
   message: z.string()
});

export type LoginResponse = z.infer<typeof loginReturnSchema>;
