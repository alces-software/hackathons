import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { InternalServerErrorSchema, NotFoundErrorSchema } from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { UsernameParamSchema } from '../../../../lib/schema/param';
import { ensureAccountExists } from '../lib/helpers';
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
         204: {
            description: 'Deleted a user successfully'
         }
      },
      ...NotFoundErrorSchema,
      ...InternalServerErrorSchema
   }),
   async (c) => {
      const { username } = c.req.valid('param');

      // Get the user information
      const user = await prisma.$transaction(async (tx) => {
         return await ensureAccountExists(username, tx, {});
      });

      return c.json(serializeUser(user), 200);
   }
);
