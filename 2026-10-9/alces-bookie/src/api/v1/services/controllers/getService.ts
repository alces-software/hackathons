import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { InternalServerErrorSchema, NotFoundErrorSchema } from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { ParamServiceNameSchema } from '../../../../lib/schema/param';
import { ensureServiceExists } from '../lib/helpers';
import { ServicesDefaultInclude } from '../lib/includes';
import { ServiceReturnSchema } from '../lib/schemas';
import { serializeService } from '../lib/serializers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'get',
      path: '/',
      description: 'Get a service',
      tags: ['Services'],
      request: {
         params: z.object({
            name: ParamServiceNameSchema
         })
      },
      responses: {
         200: {
            description: 'Retrieved a service successfully',
            content: {
               'application/json': {
                  schema: ServiceReturnSchema
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
         return await ensureServiceExists(name, tx, ServicesDefaultInclude);
      });

      return c.json(serializeService(service), 200);
   }
);
