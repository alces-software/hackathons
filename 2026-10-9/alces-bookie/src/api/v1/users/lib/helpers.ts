import { Prisma } from "@prisma/client";

import APIError, { APIErrorCode } from "../../../../lib/errors/apiError";

/**
 * Try's to get the account from the database
 * @param username The username from the account
 * @param tx The prisma transaction
 * @param include Information you want to get about the account
 * @returns The account from the database
 */
export async function ensureAccountExists<T extends Prisma.AccountsInclude | undefined>(
   username: string,
   tx: Prisma.TransactionClient,
   include?: T
): Promise<
   Prisma.AccountsGetPayload<T extends undefined ? { select: { username: true } } : { include: T }>
> {
   return await tx.accounts
      .findUnique({
         where: { username },
         ...(include === undefined && {
            select: { username: true }
         }),
         ...(include !== undefined && {
            include
         })
      })
      .then((account) => {
         if (!account) {
            throw new APIError(APIErrorCode.NotFound, {
               message: `No account with the username ${username} exists`
            });
         }
         return account as Prisma.AccountsGetPayload<
            T extends undefined ? { select: { username: true } } : { include: T }
         >;
      });
}

/**
 * Makes sure the account doesn't exist already
 * @param username The username from the account
 * @param tx The prisma transaction
 */
export async function ensureAssetDoesntExist(
   username: string,
   tx: Prisma.TransactionClient
): Promise<void> {
   await tx.accounts
      .findUnique({
         where: { username }
      })
      .then((account) => {
         if (account) {
            throw new APIError(APIErrorCode.Conflict, {
               account: `A account with the username ${username} already exists`
            });
         }
      });
}