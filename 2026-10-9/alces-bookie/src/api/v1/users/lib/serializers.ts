import { z } from '@hono/zod-openapi';
import { Prisma } from '@prisma/client';

import { UserDefaultInclude } from './includes';
import { UserReturnSchema } from './schemas';

/**
 * Serializes the user information into a given format
 * @param user The user information
 * @returns The serialized data
 */
export function serializeUser(
   user: Prisma.UsersGetPayload<{ include: typeof UserDefaultInclude }>
): z.infer<typeof UserReturnSchema> {
   return {
      id: user.id,
      username: user.username,
      balance: user.Account.balance.toNumber(),
      debt: user.debt.toNumber(),
      winnings: user.winnings.toNumber(),
      losses: user.losses.toNumber()
   };
}
