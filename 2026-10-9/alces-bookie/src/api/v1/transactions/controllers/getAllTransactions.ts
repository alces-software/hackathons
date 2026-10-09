import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { Prisma } from '@prisma/client';

import { InternalServerErrorSchema, NotFoundErrorSchema } from '../../../../lib/errors/schemas';
import {
   PaginationParamsSchema,
   PaginationResponseSchema
} from '../../../../lib/pagination/schemas';
import { paginationOptions, serializePagination } from '../../../../lib/pagination/serializers';
import { prisma } from '../../../../lib/prisma';
import { transactionInclude } from '../lib/includes';
import { TransactionReturnSchema } from '../lib/schemas';
import { serializeTransaction } from '../lib/serializers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'get',
      path: '/',
      description: 'Get all transactions',
      tags: ['Transactions'],
      request: {
         query: z.object({
            ...PaginationParamsSchema
         })
      },
      responses: {
         200: {
            description: 'Retired all transactions successfully',
            content: {
               'application/json': {
                  schema: PaginationResponseSchema(TransactionReturnSchema)
               }
            }
         },
         ...NotFoundErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const query = c.req.valid('query');

      const [transactions, transactionsCount] = await prisma.$transaction(async (tx) => {
         // create the where statement
         const where: Prisma.LedgerWhereInput = {};

         // Get all the transactions and a total count
         return [
            await tx.ledger.findMany({
               where,
               include: transactionInclude,
               ...paginationOptions(query.page, query.limit)
            }),
            await tx.ledger.count({ where })
         ];
      });

      return c.json(
         {
            data: transactions.map(serializeTransaction),
            ...serializePagination(query.page, query.limit, transactions.length, transactionsCount)
         },
         200
      );
   }
);
