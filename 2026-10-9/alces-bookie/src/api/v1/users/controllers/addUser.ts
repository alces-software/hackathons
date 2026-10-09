import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { ConflictErrorSchema, InternalServerErrorSchema } from '../../../../lib/errors/schemas';

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

      return c.body(null, 204);
   }
);
