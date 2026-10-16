import { Prisma } from '@prisma/client';

import { Bounty } from './schemas';

export function serializeBounty(bounty: Prisma.BountyGetPayload<true>): Bounty {
   return {
      id: bounty.id,
      patron: bounty.patron,
      claiment: bounty.claiment ?? null,
      price: bounty.price.toNumber(),
      title: bounty.title,
      description: bounty.description ?? null,
      startDate: bounty.startTime,
      endDate: bounty.endTime ?? null
   };
}
