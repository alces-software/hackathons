import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { Prisma } from '@prisma/client';

import { InternalServerErrorSchema } from '../../../../lib/errors/schemas';
import {
   PaginationParamsSchema,
   PaginationResponseSchema
} from '../../../../lib/pagination/schemas';
import { paginationOptions, serializePagination } from '../../../../lib/pagination/serializers';
import { prisma } from '../../../../lib/prisma';
import { ServicesDefaultInclude } from '../lib/includes';
import { ServiceReturnSchema } from '../lib/schemas';
import { serializeService } from '../lib/serializers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'get',
      path: '/',
      description: 'Get all services',
      tags: ['Services'],
      request: {
         query: z.object({
            ...PaginationParamsSchema
         })
      },
      responses: {
         200: {
            description: 'Retrieved all services successfully',
            content: {
               'application/json': {
                  schema: PaginationResponseSchema(ServiceReturnSchema)
               }
            }
         },
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const query = c.req.valid('query');

      const [services, servicesCount] = await prisma.$transaction(async (tx) => {
         // create the where statement
         const where: Prisma.ServicesWhereInput = {
            type: {
               not: 'bank'
            }
         };

         // Get all the services and a total count
         return [
            await tx.services.findMany({
               where,
               ...paginationOptions(query.page, query.limit),
               include: ServicesDefaultInclude
            }),
            await tx.services.count({ where })
         ];
      });
      return c.json(
         {
            data: services.map(serializeService),
            ...serializePagination(query.page, query.limit, services.length, servicesCount)
         },
         200
      );
   }
);
