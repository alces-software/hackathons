import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { ConflictErrorSchema, InternalServerErrorSchema } from '../../../../lib/errors/schemas';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'post',
      path: '/',
      description: 'Create a service',
      tags: ['Services'],
      request: {
         body: {
            content: {
               'application/json': {
                  schema: z.object({
                     name: z.string().min(4).max(25).trim()
                  })
               }
            }
         }
      },
      responses: {
         204: {
            description: 'Created a service successfully'
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
