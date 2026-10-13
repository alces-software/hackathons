import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import {
   InternalServerErrorSchema,
   NotFoundErrorSchema,
   UnauthorisedErrorSchema
} from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { JSONUsernameAndPasswordSchema } from '../../../../lib/schema/json';
import { ensureUserCredentialsMatch, ensureUserExists } from '../lib/helpers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'delete',
      path: '/',
      description: 'Delete a user',
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
            description: 'Deleted a user successfully'
         },
         ...NotFoundErrorSchema,
         ...UnauthorisedErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const body = c.req.valid('json');

      await prisma.$transaction(async (tx) => {
         // Ensure the user exists
         await ensureUserExists(body.username, tx);

         // Make sure the user exists and user credentials match
         await ensureUserCredentialsMatch(body.username, body.password, tx);

         // Delete the account
         await tx.users.delete({
            where: { username: body.username }
         });
      });

      return c.body(null, 204);
   }
);
