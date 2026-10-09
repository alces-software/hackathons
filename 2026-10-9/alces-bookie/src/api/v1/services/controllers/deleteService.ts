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
            name: z.string().min(4).max(25).trim()
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
      const { name } = c.req.valid('param');

      await prisma.$transaction(async (tx) => {
         // Make sure the service exists
         await ensureServiceExists(name, tx);

         // Delete the service
         await tx.services.delete({
            where: { name }
         });
      });

      return c.body(null, 204);
   }
);
