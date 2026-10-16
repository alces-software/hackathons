import { Prisma } from '@prisma/client';

/**
 * Services Default Include
 */
export const ServicesDefaultInclude = Prisma.validator<Prisma.ServicesInclude>()({
   Account: true
});
