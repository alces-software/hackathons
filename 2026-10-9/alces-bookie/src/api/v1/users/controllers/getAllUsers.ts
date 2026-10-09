import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { Prisma } from '@prisma/client';

import { InternalServerErrorSchema, NotFoundErrorSchema } from '../../../../lib/errors/schemas';
import {
   PaginationParamsSchema,
   PaginationResponseSchema
} from '../../../../lib/pagination/schemas';
import { paginationOptions, serializePagination } from '../../../../lib/pagination/serializers';
import { prisma } from '../../../../lib/prisma';
import { UserReturnSchema } from '../lib/schemas';
import { serializeUser } from '../lib/serializers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'get',
      path: '/',
      description: 'Get all users',
      tags: ['Users'],
      request: {
         query: z.object({
            ...PaginationParamsSchema
         })
      },
      responses: {
         200: {
            description: 'Retired all users successfully',
            content: {
               'application/json': {
                  schema: PaginationResponseSchema(UserReturnSchema)
               }
            }
         },
         ...NotFoundErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const query = c.req.valid('query');

      const [users, usersCount] = await prisma.$transaction(async (tx) => {
         // create the where statement
         const where: Prisma.AccountsWhereInput = {};

         // Get all the users and a total count
         return [
            await tx.accounts.findMany({
               where,
               ...paginationOptions(query.page, query.limit)
            }),
            await tx.accounts.count({ where })
         ];
      });

      return c.json(
         {
            data: users.map(serializeUser),
            ...serializePagination(query.page, query.limit, users.length, usersCount)
         },
         200
      );
   }
);
