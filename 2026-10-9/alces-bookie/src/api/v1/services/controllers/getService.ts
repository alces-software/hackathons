import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { InternalServerErrorSchema, NotFoundErrorSchema } from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { ensureServiceExists } from '../lib/helpers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'get',
      path: '/',
      description: 'Get a service',
      tags: ['Services'],
      request: {
         params: z.object({
            name: z.string().min(4).max(25).trim()
         })
      },
      responses: {
         200: {
            description: 'Retrieved a service successfully',
            content: {
               'application/json': {
                  schema: z.object({
                     id: z.int(),
                     name: z.string()
                  })
               }
            }
         },
         ...NotFoundErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const { name } = c.req.valid('param');

      // Get the service information
      const service = await prisma.$transaction(async (tx) => {
         return await ensureServiceExists(name, tx, {});
      });

      return c.json(
         {
            id: service.id,
            name: service.name!
         },
         200
      );
   }
);
