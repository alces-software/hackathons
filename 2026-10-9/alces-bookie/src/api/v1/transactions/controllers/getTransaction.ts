import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { InternalServerErrorSchema, NotFoundErrorSchema } from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { ensureTransactionExists } from '../lib/helpers';
import { transactionInclude } from '../lib/includes';
import { TransactionReturnSchema } from '../lib/schemas';
import { serializeTransaction } from '../lib/serializers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'get',
      path: '/',
      description: 'Get a transaction',
      tags: ['Transaction'],
      request: {
         params: z.object({
            id: z
               .number({ error: 'ID must be a number' })
               .int({ error: 'ID must be a whole number' })
               .min(1, { error: 'ID must be more then 0' })
         })
      },
      responses: {
         200: {
            description: 'Retired a transaction successfully',
            content: {
               'application/json': {
                  schema: TransactionReturnSchema
               }
            }
         },
         ...NotFoundErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const { id } = c.req.valid('param');

      // Get the transaction information
      const transaction = await prisma.$transaction(async (tx) => {
         return await ensureTransactionExists(id, tx, transactionInclude);
      });

      return c.json(serializeTransaction(transaction), 200);
   }
);
