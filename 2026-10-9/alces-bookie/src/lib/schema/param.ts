import { z } from '@hono/zod-openapi';

/**
 * A param schema for the username
 */
export const ParamUsernameSchema = z
   .string({ error: 'Username must be a string' })
   .trim()
   .min(4, { error: 'Username must be at least 4 characters long' })
   .max(25, { error: 'Username cannot be more than 25 characters long' });

/**
 * A param schema for the service token
 */
export const ParamServiceTokenSchema = z
   .string({ error: 'Service token must be a string' })
   .trim()
   .length(32, { error: 'Service token must be 32 characters long' });

/**
 * A param schema for a services name
 */
export const ParamServiceNameSchema = z
   .string({ error: 'Name must be a string' })
   .trim()
   .min(4, { error: 'Name must be more than 4 characters' })
   .max(25, { error: 'Name cannot be more than 25 characters' });
