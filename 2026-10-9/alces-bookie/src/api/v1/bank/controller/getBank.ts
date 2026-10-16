import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { env } from '../../../../lib/env';
import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';
import { InternalServerErrorSchema } from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { ensureServiceExists } from '../../services/lib/helpers';
import { ServicesDefaultInclude } from '../../services/lib/includes';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'get',
      path: '/',
      description: 'Get the banks information',
      tags: ['Bank'],
      responses: {
         200: {
            description: 'Retrieved the banks information successfully',
            content: {
               'application/json': {
                  schema: z.object({
                     balance: z.number()
                  })
               }
            }
         },
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const bank = await prisma.$transaction(async (tx) => {
         // Get the bank from the database
         return await ensureServiceExists(env.BANK_USERNAME, tx, ServicesDefaultInclude);
      });

      // Make sure the bank has an account
      if (bank.Account === null || bank.account_id === null) {
         throw new APIError(APIErrorCode.InternalServerError);
      }

      return c.json(
         {
            balance: bank.Account.balance.toNumber()
         },
         200
      );
   }
);
