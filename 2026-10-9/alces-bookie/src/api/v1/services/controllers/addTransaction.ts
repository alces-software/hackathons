import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { Prisma } from '@prisma/client';

import { env } from '../../../../lib/env';
import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';
import {
   BadRequestErrorSchema,
   InternalServerErrorSchema,
   NotFoundErrorSchema,
   UnauthorisedErrorSchema
} from '../../../../lib/errors/schemas';
import { publish } from '../../../../lib/publisher';
import { JSONUsernameAndPasswordSchema } from '../../../../lib/schema/json';
import { transactionWithRetry } from '../../../../lib/transactionWithRetry';
import { ensureUserCredentialsMatch, ensureUserExists } from '../../users/lib/helpers';
import { UserDefaultInclude } from '../../users/lib/includes';
import { ensureServiceExists, ensureServiceExistsToken } from '../lib/helpers';
import { ServicesDefaultInclude } from '../lib/includes';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'post',
      path: '/',
      description: 'Performs a transaction for service',
      tags: ['Services', 'Transactions'],
      request: {
         body: {
            content: {
               'application/json': {
                  schema: z.object({
                     ...JSONUsernameAndPasswordSchema,
                     serviceToken: z
                        .string({ error: 'Service token must be a string' })
                        .trim()
                        .min(1, { error: 'Service token cannot be empty' }),
                     amount: z
                        .number({ error: 'Amount must be a number' })
                        .min(0, { error: 'Amount must be more than 0' })
                        .transform((value) => Number(value.toFixed(2))),
                     type: z.enum(['win', 'loss', 'hold', 'return'], {
                        error: 'The type must be either a win, loss, hold, return'
                     })
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
         const service = await ensureServiceExistsToken(
            body.serviceToken,
            tx,
            ServicesDefaultInclude
         );

         // Check that the service has an account
         if (service.account_id === null || service.Account === null) {
            throw new APIError(APIErrorCode.BadRequest, {
               message: 'Service does now have an account'
            });
         }

         // Ensure that the user exists
         const user = await ensureUserExists(body.username, tx, UserDefaultInclude);

         // Ensure that user credentials are correct
         await ensureUserCredentialsMatch(body.username, body.password, tx);

         // Make sure the send has enough in their account
         if (
            (body.type === 'loss' || body.type === 'hold') &&
            user.Account.balance.minus(body.amount).lessThan(0)
         ) {
            throw new APIError(APIErrorCode.BadRequest, {
               message: `${user.username} does not have enough to transfer`
            });
         }

         // Update service
         await tx.accounts.update({
            where: { id: service.account_id },
            data: {
               ...(body.type === 'win' || body.type === 'return'
                  ? {
                       balance: { decrement: body.amount }
                    }
                  : {
                       balance: { increment: body.amount }
                    })
            }
         });

         // Bank takes cut if debt is present
         if (body.type === 'win' && user.debt.greaterThan(0)) {
            const amount = new Prisma.Decimal(body.amount);
            const repayment = Prisma.Decimal.min(
               amount.mul(env.LOAN_REPAY).toDecimalPlaces(2),
               user.debt
            );
            body.amount = amount.minus(repayment).toNumber();

            // Get the bank from the database
            const bank = await ensureServiceExists(env.BANK_USERNAME, tx, ServicesDefaultInclude);

            // Make sure the bank has an account
            if (bank.Account === null || bank.account_id === null) {
               throw new APIError(APIErrorCode.InternalServerError);
            }

            await tx.accounts.update({
               where: { id: bank.account_id },
               data: { balance: { increment: repayment } }
            });

            await tx.users.update({
               where: { username: body.username },
               data: { debt: { decrement: repayment } }
            });
         }

         // Update user
         await tx.users.update({
            where: { username: body.username },
            data: {
               ...(body.type === 'win' && {
                  Account: {
                     update: {
                        data: {
                           balance: { increment: body.amount }
                        }
                     }
                  },
                  winnings: { increment: body.amount }
               }),
               ...(body.type === 'loss' && {
                  Account: {
                     update: {
                        data: {
                           balance: { decrement: body.amount }
                        }
                     }
                  },
                  losses: { increment: body.amount }
               }),
               ...(body.type === 'hold' && {
                  Account: {
                     update: {
                        data: {
                           balance: { decrement: body.amount }
                        }
                     }
                  }
               }),
               ...(body.type === 'return' && {
                  Account: {
                     update: {
                        data: {
                           balance: { increment: body.amount }
                        }
                     }
                  }
               })
            }
         });

         // Add ledger transaction
         return await tx.ledger.create({
            data: {
               ...(body.type === 'win' || body.type === 'return'
                  ? {
                       sender_account_id: service.account_id,
                       receiver_account_id: user.account_id
                    }
                  : {
                       sender_account_id: user.account_id,
                       receiver_account_id: service.account_id
                    }),
               service_id: service.id,
               amount: body.amount,
               created_at: new Date()
            },
            select: {
               id: true
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
