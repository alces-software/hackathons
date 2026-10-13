import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';
import {
   InternalServerErrorSchema,
   NotFoundErrorSchema,
   UnauthorisedErrorSchema
} from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { JSONPasswordSchema, JSONUsernameAndPasswordSchema } from '../../../../lib/schema/json';
import { ensureUserCredentialsMatch, ensureUserExists } from '../lib/helpers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'patch',
      path: '/',
      description: 'Update a user',
      tags: ['Users'],
      request: {
         body: {
            content: {
               'application/json': {
                  schema: z.object({
                     ...JSONUsernameAndPasswordSchema,
                     newPassword: JSONPasswordSchema
                  })
               }
            }
         }
      },
      responses: {
         204: {
            description: 'Updated user successfully'
         },
         ...UnauthorisedErrorSchema,
         ...NotFoundErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const body = c.req.valid('json');

      await prisma.$transaction(async (tx) => {
         // Check that the user exists
         const user = await ensureUserExists(body.username, tx, {});

         // Make sure the users credentials are correct
         await ensureUserCredentialsMatch(body.username, body.password, tx);

         // Make sure the new password is different
         if (user.password === body.newPassword) {
            throw new APIError(APIErrorCode.Conflict, {
               error: 'The new password is the same as the previous one try again'
            });
         }

         // Update the user with the new password
         await tx.users.update({
            where: { username: user.username },
            data: { password: body.newPassword }
         });
      });

      return c.body(null, 204);
   }
);
