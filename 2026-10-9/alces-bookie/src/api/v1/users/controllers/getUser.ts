import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { InternalServerErrorSchema, NotFoundErrorSchema } from '../../../../lib/errors/schemas';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'get',
      path: '/',
      description: 'Get a user',
      tags: ['Users'],
      request: {
         params: z.object({
            username: z.string().trim()
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

      return c.body(null, 204);
   }
);
