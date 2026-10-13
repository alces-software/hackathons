import { z } from '@hono/zod-openapi';
import { Prisma } from '@prisma/client';

import { UserReturnSchema } from './schemas';

/**
 * Serializes the user information into a given format
 * @param user The user information
 * @returns The serialized data
 */
export function serializeUser(
   user: Prisma.UsersGetPayload<Prisma.UsersDefaultArgs>
): z.infer<typeof UserReturnSchema> {
   return {
      id: user.id,
      username: user.username,
      balance: user.balance.toNumber(),
      debt: user.debt.toNumber(),
      winnings: user.winnings.toNumber(),
      loses: user.loses.toNumber()
   };
}
