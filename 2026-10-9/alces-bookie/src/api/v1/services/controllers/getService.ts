import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { ConflictErrorSchema, InternalServerErrorSchema } from '../../../../lib/errors/schemas';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'post',
      path: '/',
      description: 'Create a service',
      tags: ['Services'],
      request: {
         params: z.object({
            name: z.string().min(4).max(25).trim()
         })
      },
      responses: {
         201: {
            description: 'Retrieved all services'
         }
      },
      ...ConflictErrorSchema,
      ...InternalServerErrorSchema
   }),
   async (c) => {
      return c.body(null, 201);
   }
);
