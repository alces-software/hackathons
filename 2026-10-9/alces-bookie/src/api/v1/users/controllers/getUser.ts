import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { InternalServerErrorSchema, NotFoundErrorSchema } from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { UsernameParamSchema } from '../../../../lib/schema/param';
import { ensureUserExists } from '../lib/helpers';
import { UserDefaultInclude } from '../lib/includes';
import { UserReturnSchema } from '../lib/schemas';
import { serializeUser } from '../lib/serializers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'get',
      path: '/',
      description: 'Get a user',
      tags: ['Users'],
      request: {
         params: z.object({
            ...UsernameParamSchema
         })
      },
      responses: {
         200: {
            description: 'Retired a user successfully',
            content: {
               'application/json': {
                  schema: UserReturnSchema
               }
            }
         },
         ...NotFoundErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const { username } = c.req.valid('param');

      // Get the user information
      const user = await prisma.$transaction(async (tx) => {
         return await ensureUserExists(username, tx, UserDefaultInclude);
      });

      return c.json(serializeUser(user), 200);
   }
);
