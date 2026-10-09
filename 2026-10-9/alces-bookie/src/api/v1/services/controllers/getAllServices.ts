import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { ConflictErrorSchema, InternalServerErrorSchema } from '../../../../lib/errors/schemas';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'post',
      path: '/',
      description: 'Create a service',
      tags: ['Services'],
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
