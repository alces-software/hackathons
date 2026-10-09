import { Prisma } from '@prisma/client';

import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';

/**
 * Try's to get the account from the database
 * @param name The name from the service
 * @param tx The prisma transaction
 * @param include Information you want to get about the account
 * @returns The account from the database
 */
export async function ensureServiceExists<T extends Prisma.AccountsInclude | undefined>(
   name: string,
   tx: Prisma.TransactionClient,
   include?: T
): Promise<
   Prisma.ServicesGetPayload<T extends undefined ? { select: { name: true } } : { include: T }>
> {
   return await tx.services
      .findUnique({
         where: { name },
         ...(include === undefined && {
            select: { name: true }
         }),
         ...(include !== undefined && {
            include
         })
      })
      .then((service) => {
         if (!service) {
            throw new APIError(APIErrorCode.NotFound, {
               message: `No service with the name ${name} exists`
            });
         }
         return service as Prisma.ServicesGetPayload<
            T extends undefined ? { select: { name: true } } : { include: T }
         >;
      });
}

/**
 * Makes sure the account doesn't exist already
 * @param name The name from the asset
 * @param tx The prisma transaction
 */
export async function ensureAssetDoesntExist(
   name: string,
   tx: Prisma.TransactionClient
): Promise<void> {
   await tx.services
      .findUnique({
         where: { name }
      })
      .then((asset) => {
         if (asset) {
            throw new APIError(APIErrorCode.Conflict, {
               message: `A service with the name ${name} already exists`
            });
         }
      });
}
