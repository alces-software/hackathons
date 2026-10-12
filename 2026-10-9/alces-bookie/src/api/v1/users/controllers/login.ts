import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { ConflictErrorSchema, InternalServerErrorSchema } from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { JSONUsernameAndPasswordSchema } from '../../../../lib/schema/json';
import { ensureAccountCredentialsMatch } from '../lib/helpers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'post',
      path: '/',
      description: 'Login a user',
      tags: ['Users'],
      request: {
         body: {
            content: {
               'application/json': {
                  schema: z.object({
                     ...JSONUsernameAndPasswordSchema
                  })
               }
            }
         }
      },
      responses: {
         204: {
            description: 'logged in successfully'
         },
         ...ConflictErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const body = c.req.valid('json');

      await prisma.$transaction(async (tx) => {
         // Check that the account details are correct
         await ensureAccountCredentialsMatch(body.username, body.password, tx);
      });

      return c.body(null, 204);
   }
);
