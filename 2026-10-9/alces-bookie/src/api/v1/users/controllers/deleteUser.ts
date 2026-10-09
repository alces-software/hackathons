import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import {
   InternalServerErrorSchema,
   NotFoundErrorSchema,
   UnauthorisedErrorSchema
} from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { ensureAccountCredentialsMatch } from '../lib/helpers';

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
                     username: z.string().trim(),
                     password: z.hash('sha256').trim()
                  })
               }
            }
         }
      },
      responses: {
         204: {
            description: 'Deleted a user successfully'
         }
      },
      ...NotFoundErrorSchema,
      ...UnauthorisedErrorSchema,
      ...InternalServerErrorSchema
   }),
   async (c) => {
      const body = c.req.valid('json');

      await prisma.$transaction(async (tx) => {
         // Make sure the user exists and user credentials match
         await ensureAccountCredentialsMatch(body.username, body.password, tx);

         // Delete the account
         await tx.accounts.delete({
            where: { username: body.username }
         });
      });

      return c.body(null, 204);
   }
);
