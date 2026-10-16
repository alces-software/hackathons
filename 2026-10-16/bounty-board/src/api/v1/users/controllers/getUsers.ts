import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { env } from '../../../../lib/env';
import { BadRequestErrorSchema, InternalServerErrorSchema } from '../../../../lib/errors/schemas';
import {
   PaginationParamsSchema,
   PaginationResponseSchema
} from '../../../../lib/pagination/schemas';
import { userReturnSchema } from '../lib/schemas';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'get',
      path: '/',
      description: 'Get all users from the bank',
      tags: ['Users'],
      request: {
         query: z.object({
            ...PaginationParamsSchema,
            orderByBalance: z.enum(['asc', 'desc']).optional().meta({
               description: 'The order of the users by their balance'
            })
         })
      },
      responses: {
         200: {
            description: 'Retrieved all users successfully',
            content: {
               'application/json': {
                  schema: PaginationResponseSchema(userReturnSchema)
               }
            }
         },
         ...BadRequestErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const { page, limit, orderByBalance } = c.req.valid('query');

      // Proxy the query to the bank
      const query = new URLSearchParams({
         page: page.toString(),
         limit: limit.toString()
      });

      if (orderByBalance) {
         query.set('orderByBalance', orderByBalance);
      }

      const apiUrl = new URL('users', env.BANK_API);
      apiUrl.search = query.toString();

      const response = await fetch(apiUrl);
      const users = await response.json();

      // Relay the response from the bank
      return c.json(users, response.status === 200 ? 200 : 500);
   }
);
