import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { ConflictErrorSchema, InternalServerErrorSchema } from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { ensureAccountDoesntExist } from '../lib/helpers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'post',
      path: '/',
      description: 'Create a user',
      tags: ['Users'],
      request: {
         body: {
            content: {
               'application/json': {
                  schema: z.object({
                     username: z.string().trim(),
                     password: z.hash('sha256').trim()
                  })
               }
            }
         }
      },
      responses: {
         201: {
            description: 'Created a user successfully'
         }
      },
      ...ConflictErrorSchema,
      ...InternalServerErrorSchema
   }),
   async (c) => {
      const body = c.req.valid('json');

      await prisma.$transaction(async (tx) => {
         // Make sure an account with the username doesnt already exist
         await ensureAccountDoesntExist(body.username, tx);
      });

      return c.body(null, 204);
   }
);
