import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { env } from '../../../../lib/env';
import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';
import {
   BadRequestErrorSchema,
   InternalServerErrorSchema,
   NotFoundErrorSchema,
   UnauthorisedErrorSchema
} from '../../../../lib/errors/schemas';
import { publish } from '../../../../lib/publisher';
import { JSONServiceTokenSchema, JSONUsernameSchema } from '../../../../lib/schema/json';
import { transactionWithRetry } from '../../../../lib/transactionWithRetry';
import { ensureServiceExists, ensureServiceExistsToken } from '../../services/lib/helpers';
import { ServicesDefaultInclude } from '../../services/lib/includes';
import { ensureUserExists } from '../../users/lib/helpers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'post',
      path: '/',
      description: 'Gives an achievement payout to users',
      tags: ['Services', 'Transactions'],
      request: {
         body: {
            content: {
               'application/json': {
                  schema: z.object({
                     username: JSONUsernameSchema,
                     serviceToken: JSONServiceTokenSchema
                  })
               }
            }
         }
      },
      responses: {
         200: {
            description: 'Successfully created a transaction',
            content: {
               'application/json': {
                  schema: z.object({
                     id: z.int()
                  })
               }
            }
         },
         ...BadRequestErrorSchema,
         ...UnauthorisedErrorSchema,
         ...NotFoundErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const body = c.req.valid('json');

      const transactionID = await transactionWithRetry(async (tx) => {
         // Ensure the service exists
         await ensureServiceExistsToken(body.serviceToken, tx);

         // Ensure that the user exists
         const user = await ensureUserExists(body.username, tx, {});

         // Get the bank from the database
         const bank = await ensureServiceExists(env.BANK_USERNAME, tx, ServicesDefaultInclude);

         // Make sure the bank has an account
         if (bank.Account === null || bank.account_id === null) {
            throw new APIError(APIErrorCode.InternalServerError);
         }

         // Check that the bank can perform the loan
         if (bank.Account.balance.minus(env.ACHIEVEMENT_PAYOUT).lessThan(0)) {
            throw new APIError(APIErrorCode.BadRequest, {
               message: 'The bank cannot fund this loan at the moment'
            });
         }

         // Get the achievement service from the database
         const achievementService = await tx.services
            .findUnique({
               where: {
                  name: 'Achievement'
               },
               select: {
                  id: true
               }
            })
            .then((service) => {
               if (!service) {
                  throw new APIError(APIErrorCode.InternalServerError);
               }
               return service;
            });

         // Update bank
         await tx.accounts.update({
            where: {
               id: bank.account_id
            },
            data: {
               balance: { decrement: env.ACHIEVEMENT_PAYOUT }
            }
         });

         // Update user
         await tx.accounts.update({
            where: {
               id: user.account_id
            },
            data: {
               balance: { increment: env.ACHIEVEMENT_PAYOUT }
            }
         });

         // Add ledger
         return await tx.ledger.create({
            data: {
               sender_account_id: bank.account_id,
               receiver_account_id: user.account_id,
               service_id: achievementService.id,
               amount: env.ACHIEVEMENT_PAYOUT,
               type: 'transfer'
            }
         });
      });

      // Update the websocket
      publish({
         type: 'content.created',
         id: 'transactions',
         timestamp: new Date().toISOString()
      });

      return c.json(
         {
            id: transactionID.id
         },
         200
      );
   }
);
