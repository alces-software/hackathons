import { Prisma } from '@prisma/client';

import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';

/**
 * Try's to get the transaction from the database
 * @param id The ID fo the transaction
 * @param tx The prisma transaction
 * @param include Information you want to get about the transaction
 * @returns The transaction from the database
 */
export async function ensureTransactionExists<T extends Prisma.LedgerInclude | undefined>(
   id: number,
   tx: Prisma.TransactionClient,
   include?: T
): Promise<
   Prisma.LedgerGetPayload<T extends undefined ? { select: { id: true } } : { include: T }>
> {
   return await tx.ledger
      .findUnique({
         where: { id },
         ...(include === undefined && {
            select: { id: true }
         }),
         ...(include !== undefined && {
            include
         })
      })
      .then((transaction) => {
         if (!transaction) {
            throw new APIError(APIErrorCode.NotFound, {
               message: `No transaction exists with the ID ${id}`
            });
         }
         return transaction as Prisma.LedgerGetPayload<
            T extends undefined ? { select: { id: true } } : { include: T }
         >;
      });
}
