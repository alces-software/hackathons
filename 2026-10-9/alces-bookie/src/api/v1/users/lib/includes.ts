import { Prisma } from '@prisma/client';

/**
 * Transaction default include
 */
export const UserDefaultInclude = Prisma.validator<Prisma.UsersInclude>()({
   Account: true
});
