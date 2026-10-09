import { Prisma } from '@prisma/client';

/**
 * Transaction default include
 */
export const transactionInclude = Prisma.validator<Prisma.LedgerInclude>()({
   Services: true
});
