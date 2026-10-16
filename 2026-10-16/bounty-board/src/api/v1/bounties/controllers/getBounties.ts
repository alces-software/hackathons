import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { BadRequestErrorSchema, InternalServerErrorSchema } from '../../../../lib/errors/schemas';
import {
   PaginationParamsSchema,
   PaginationResponseSchema
} from '../../../../lib/pagination/schemas';
import { paginationOptions, serializePagination } from '../../../../lib/pagination/serializers';
import { prisma } from '../../../../lib/prisma';
import { bountyReturnSchema } from '../lib/schemas';
import { serializeBounty } from '../lib/serializers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'get',
      path: '/',
      description: 'Get all bounties, optionally filtered by whether they are completed or not',
      tags: ['Bounty'],
      request: {
         query: z.object({
            ...PaginationParamsSchema,
            completed: z.enum(['true', 'false']).optional().meta({
               description: 'Only get bounties that are completed or not completed'
            })
         })
      },
      responses: {
         200: {
            description: 'Retrieved all bounties successfully',
            content: {
               'application/json': {
                  schema: PaginationResponseSchema(bountyReturnSchema)
               }
            }
         },
         ...BadRequestErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const { page, limit, completed } = c.req.valid('query');

      const completedFilter =
         completed === 'true'
            ? { endTime: { not: null } }
            : completed === 'false'
              ? { endTime: null }
              : undefined;

      // Get the bounties and how many there are in total
      const bounties = await prisma.bounty.findMany({
         where: completedFilter,
         ...paginationOptions(page, limit)
      });
      const itemTotal = await prisma.bounty.count({
         where: completedFilter
      });

      return c.json(
         {
            data: bounties.map(serializeBounty),
            ...serializePagination(page, limit, bounties.length, itemTotal)
         },
         200
      );
   }
);
