import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { InternalServerErrorSchema, NotFoundErrorSchema } from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { ensureServiceExists } from '../lib/helpers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'delete',
      path: '/',
      description: 'Delete a service',
      tags: ['Services'],
      request: {
         params: z.object({
            name: z
               .string({ error: 'Name must be a string' })
               .trim()
               .min(4, { error: 'Name must be more than 4 characters' })
               .max(25, { error: 'Name cannot be more than 25 characters' }),
            serviceToken: z
               .string({ error: 'Service token must be a string' })
               .trim()
               .length(32, { error: 'Service token must be 32 characters long' })
         })
      },
      responses: {
         204: {
            description: 'Deleted a service successfully'
         },
         ...NotFoundErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const { name, serviceToken } = c.req.valid('param');

      await prisma.$transaction(async (tx) => {
         // Make sure the service exists
         await ensureServiceExists(name, tx);

         // Delete the service
         await tx.services.delete({
            where: { name, token: serviceToken }
         });
      });

      return c.body(null, 204);
   }
);
