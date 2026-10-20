import { hash } from 'node:crypto';

import { z } from '@hono/zod-openapi';

/**
 * A JSON for the username
 */
export const JSONUsernameSchema = z
   .string({ error: 'Username must be a string' })
   .trim()
   .min(4, { error: 'Username must be at least 4 characters long' })
   .max(25, { error: 'Username cannot be more than 25 characters long' });

/**
 * A JSON for the password
 */
export const JSONPasswordSchema = z
   .string({ error: 'Password must be a string' })
   .trim()
   .min(4, { error: 'Password must be at least 4 characters long' })
   .max(30, { error: 'Password cannot be more than 30 characters long' })
   .transform((value) => hash('sha256', value));

/**
 * A JSON schema for the username and password
 */
export const JSONUsernameAndPasswordSchema = {
   username: JSONUsernameSchema,
   password: JSONPasswordSchema
};

/**
 * A JSON schema for the Service token
 */
export const JSONServiceTokenSchema = z
   .string({ error: 'Service token must be a string' })
   .trim()
   .length(32, { error: 'Service token must be 32 characters long' });

/**
 * A JSON schema for the amount
 */
export const JSONAmountSchema = z
   .number({ error: 'Amount must be a number' })
   .min(0, { error: 'Amount must be more than 0' })
   .transform((value) => Number(value.toFixed(2)))
   .refine((value) => value > 0, {
      error: 'Amount must be at least 0.01'
   });

/**
 * A JSON schema for the transaction type
 */
export const JSONTransactionTypeSchema = z.enum(['win', 'loss', 'hold', 'return'], {
   error: 'The type must be either a win, loss, hold or return'
});

/**
 * A JSON schema for a services name
 */
export const JSONServiceNameSchema = z
   .string({ error: 'Name must be a string' })
   .trim()
   .min(4, { error: 'Name must be more than 4 characters' })
   .max(25, { error: 'Name cannot be more than 25 characters' });
