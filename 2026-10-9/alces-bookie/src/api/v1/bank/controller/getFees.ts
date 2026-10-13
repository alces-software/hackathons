import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { env } from '../../../../lib/env';
import { InternalServerErrorSchema } from '../../../../lib/errors/schemas';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'get',
      path: '/',
      description: 'Get the transaction fees',
      tags: ['Bank'],
      responses: {
         200: {
            description: 'Retrieved the transaction fees successfully',
            content: {
               'application/json': {
                  schema: z.object({
                     userTransactionFee: z.number(),
                     serviceTransactionFee: z.number()
                  })
               }
            }
         },
         ...InternalServerErrorSchema
      }
   }),
   (c) => {
      return c.json(
         {
            userTransactionFee: Number(env.USER_TRANSACTION_FEE * 100),
            serviceTransactionFee: Number(env.SERVICE_TRANSACTION_FEE * 100)
         },
         200
      );
   }
);
