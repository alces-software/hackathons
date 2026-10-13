import { Prisma } from '@prisma/client';

import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';

/**
 * Try's to get the service from the database
 * @param name The name from the service
 * @param tx The prisma transaction
 * @param include Information you want to get about the service
 * @returns The service from the database
 */
export async function ensureServiceExists<T extends Prisma.ServicesInclude | undefined>(
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
 * Try's to get the service from the database using its token
 * @param token The token from the service
 * @param tx The prisma transaction
 * @param include Information you want to get about the service
 * @returns The service from the database
 */
export async function ensureServiceExistsToken<T extends Prisma.ServicesInclude | undefined>(
   token: string,
   tx: Prisma.TransactionClient,
   include?: T
): Promise<
   Prisma.ServicesGetPayload<T extends undefined ? { select: { name: true } } : { include: T }>
> {
   return await tx.services
      .findUnique({
         where: { token },
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
               message: `No service with that token exists`
            });
         }
         return service as Prisma.ServicesGetPayload<
            T extends undefined ? { select: { name: true } } : { include: T }
         >;
      });
}

/**
 * Makes sure the service doesn't exist already
 * @param name The name from the service
 * @param tx The prisma transaction
 */
export async function ensureServiceDoesntExist(
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
