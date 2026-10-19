import { z } from '@hono/zod-openapi';
import { Prisma } from '@prisma/client';

import { TransactionDefaultInclude } from './includes';
import { TransactionReturnSchema } from './schemas';

/**
 * Serializes the transaction information into a given format
 * @param transaction The transaction information
 * @returns The serialized data
 */
export function serializeTransaction(
   transaction: Prisma.LedgerGetPayload<{ include: typeof TransactionDefaultInclude }>
): z.infer<typeof TransactionReturnSchema> {
   return {
      id: transaction.id,
      sender: transaction.Account_Ledger_sender_account_idToAccount?.Users?.username ?? null,
      receiver: transaction.Account_Ledger_receiver_account_idToAccount.Users?.username ?? null,
      createdAt: transaction.created_at,
      amount: transaction.amount.toNumber(),
      type: transaction.type,
      service: {
         id: transaction.service_id,
         name: transaction.Services?.name ?? null
      }
   };
}
