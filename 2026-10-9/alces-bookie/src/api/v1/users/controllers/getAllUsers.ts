import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { InternalServerErrorSchema, NotFoundErrorSchema } from '../../../../lib/errors/schemas';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'get',
      path: '/',
      description: 'Get all users',
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
      ...InternalServerErrorSchema
   }),
   async (c) => {
      const body = c.req.valid('json');

      return c.body(null, 204);
   }
);
