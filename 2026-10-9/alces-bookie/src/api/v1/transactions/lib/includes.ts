import { Prisma } from '@prisma/client';

/**
 * Transaction default include
 */
export const TransactionDefaultInclude = Prisma.validator<Prisma.LedgerInclude>()({
   Services: true,
   Account_Ledger_receiver_account_idToAccount: {
      include: {
         Users: true
      }
   },
   Account_Ledger_sender_account_idToAccount: {
      include: {
         Users: true
      }
   }
});
