import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { ConflictErrorSchema, InternalServerErrorSchema } from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { JSONUsernameAndPasswordSchema } from '../../../../lib/schema/json';
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
                     ...JSONUsernameAndPasswordSchema
                  })
               }
            }
         }
      },
      responses: {
         201: {
            description: 'Created a user successfully'
         },
         ...ConflictErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const body = c.req.valid('json');

      await prisma.$transaction(async (tx) => {
         // Make sure an account with the username doesnt already exist
         await ensureAccountDoesntExist(body.username, tx);

         // Create the user in the database
         await tx.accounts.create({
            data: {
               username: body.username,
               password: body.password
            }
         });
      });

      return c.body(null, 204);
   }
);
