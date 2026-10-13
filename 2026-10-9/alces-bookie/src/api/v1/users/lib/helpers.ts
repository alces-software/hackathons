import { Prisma } from '@prisma/client';

import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';

/**
 * Try's to get the user from the database
 * @param username The username from the account
 * @param tx The prisma transaction
 * @param include Information you want to get about the account
 * @returns The user from the database
 */
export async function ensureUserExists<T extends Prisma.UsersInclude | undefined>(
   username: string,
   tx: Prisma.TransactionClient,
   include?: T
): Promise<
   Prisma.UsersGetPayload<T extends undefined ? { select: { username: true } } : { include: T }>
> {
   return await tx.users
      .findUnique({
         where: {
            username
         },
         ...(include === undefined && {
            select: { username: true }
         }),
         ...(include !== undefined && {
            include
         })
      })
      .then((user) => {
         if (!user) {
            throw new APIError(APIErrorCode.NotFound, {
               message: `No user with the username ${username} exists`
            });
         }
         return user as Prisma.UsersGetPayload<
            T extends undefined ? { select: { username: true } } : { include: T }
         >;
      });
}

/**
 * Makes sure the user doesn't exist already
 * @param username The username from the user
 * @param tx The prisma transaction
 */
export async function ensureUserDoesntExist(
   username: string,
   tx: Prisma.TransactionClient
): Promise<void> {
   await tx.users
      .findFirst({
         where: {
            username
         }
      })
      .then((user) => {
         if (user) {
            throw new APIError(APIErrorCode.Conflict, {
               message: `A user with the username ${username} already exists`
            });
         }
      });
}

/**
 * Checks to make sure the users credentials match the database
 * @param username The username from the user
 * @param password The password from the user
 * @param tx The prisma transaction
 */
export async function ensureUserCredentialsMatch(
   username: string,
   password: string,
   tx: Prisma.TransactionClient
): Promise<void> {
   await tx.users
      .findFirst({
         where: {
            username,
            password
         }
      })
      .then((user) => {
         if (!user) {
            throw new APIError(APIErrorCode.Unauthorised);
         }
      });
}
