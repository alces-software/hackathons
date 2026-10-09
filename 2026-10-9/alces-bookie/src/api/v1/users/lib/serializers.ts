import { z } from '@hono/zod-openapi';
import { Prisma } from '@prisma/client';

import { UserReturnSchema } from './schemas';

/**
 * Serializes the asset information into a given format
 * @param user The user information
 * @returns The serialized data
 */
export function serializeUser(
   user: Prisma.AccountsGetPayload<Prisma.AccountsDefaultArgs>
): z.infer<typeof UserReturnSchema> {
   return {
      username: user.username,
      balance: user.balance
   };
}
