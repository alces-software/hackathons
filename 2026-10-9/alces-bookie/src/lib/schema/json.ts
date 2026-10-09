import { hash } from 'node:crypto';

import { z } from '@hono/zod-openapi';

/**
 * A JSON body schema for the username and password
 */
export const JSONUsernameAndPasswordSchema = {
   username: z
      .string({ error: 'Username must be a string' })
      .trim()
      .min(4, { error: 'Username must be at least 4 characters long' })
      .max(25, { error: 'Username cannot be more than 25 characters long' }),
   password: z
      .string({ error: 'Password must be a string' })
      .trim()
      .min(4, { error: 'Password must be at least 4 characters long' })
      .max(30, { error: 'Password cannot be more than 30 characters long' })
      .transform((value) => hash('sha256', value))
};
