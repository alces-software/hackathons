import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { ConflictErrorSchema, InternalServerErrorSchema } from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { JSONUsernameAndPasswordSchema } from '../../../../lib/schema/json';
import { ensureUserDoesntExist } from '../lib/helpers';

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
         // Make sure a user with the username doesnt already exist
         await ensureUserDoesntExist(body.username, tx);

         // Create the user in the database
         await tx.users.create({
            data: {
               username: body.username,
               password: body.password
            }
         });
      });

      return c.body(null, 201);
   }
);
