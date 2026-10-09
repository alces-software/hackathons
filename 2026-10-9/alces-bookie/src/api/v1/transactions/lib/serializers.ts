import { z } from '@hono/zod-openapi';
import { Prisma } from '@prisma/client';

import { transactionInclude } from './includes';
import { TransactionReturnSchema } from './schemas';

/**
 * Serializes the transaction information into a given format
 * @param transaction The transaction information
 * @returns The serialized data
 */
export function serializeTransaction(
   transaction: Prisma.LedgerGetPayload<{ include: typeof transactionInclude }>
): z.infer<typeof TransactionReturnSchema> {
   return {
      username: transaction.username,
      timestamp: transaction.timestamp,
      before: transaction.beforeBalance.toNumber(),
      after: transaction.afterBalance.toNumber(),
      service: {
         id: transaction.id,
         name: transaction.Services.name
      }
   };
}
