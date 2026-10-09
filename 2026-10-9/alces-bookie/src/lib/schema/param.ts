import { z } from '@hono/zod-openapi';

/**
 * A param schema for the username
 */
export const UsernameParamSchema = {
   username: z
      .string({ error: 'Username must be a string' })
      .trim()
      .min(4, { error: 'Username must be at least 4 characters long' })
      .max(25, { error: 'Username cannot be more than 25 characters long' })
};
