import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { Prisma } from '@prisma/client';

import { InternalServerErrorSchema } from '../../../../lib/errors/schemas';
import {
   PaginationParamsSchema,
   PaginationResponseSchema
} from '../../../../lib/pagination/schemas';
import { paginationOptions, serializePagination } from '../../../../lib/pagination/serializers';
import { prisma } from '../../../../lib/prisma';
import { TransactionDefaultInclude } from '../lib/includes';
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
            ...PaginationParamsSchema,
            serviceID: z.coerce
               .number({ error: 'Service ID must be a number' })
               .int({ error: 'Service ID must be a whole number' })
               .min(1, { error: 'Service ID must be more than 0' })
               .optional(),
            order: z.enum(['asc', 'desc']).default('desc'),
            transactionTypes: z
               .array(z.enum(['transfer', 'win', 'return', 'loss', 'hold']))
               .default(['transfer', 'loss', 'win'])
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
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const query = c.req.valid('query');

      const [transactions, transactionsCount] = await prisma.$transaction(async (tx) => {
         // create the where statement
         const where: Prisma.LedgerWhereInput = {
            ...(query.serviceID !== undefined && {
               service_id: query.serviceID
            }),
            ...(query.transactionTypes !== undefined && {
               type: {
                  in: query.transactionTypes
               }
            })
         };

         // Get all the transactions and a total count
         return [
            await tx.ledger.findMany({
               where,
               orderBy: { id: query.order },
               include: TransactionDefaultInclude,
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
