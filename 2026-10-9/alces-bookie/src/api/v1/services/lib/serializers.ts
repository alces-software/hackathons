import { z } from '@hono/zod-openapi';
import { Prisma } from '@prisma/client';

import { ServicesDefaultInclude } from './includes';
import { ServiceReturnSchema } from './schemas';

/**
 * Serializes the service information into a given format
 * @param service The service information
 * @returns The serialized data
 */
export function serializeService(
   service: Prisma.ServicesGetPayload<{ include: typeof ServicesDefaultInclude }>
): z.infer<typeof ServiceReturnSchema> {
   return {
      id: service.id,
      name: service.name,
      balance: service.Account?.balance.toNumber() ?? null
   };
}
