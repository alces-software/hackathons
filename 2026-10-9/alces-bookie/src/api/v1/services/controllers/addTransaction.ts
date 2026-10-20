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
import {
   JSONAmountSchema,
   JSONPasswordSchema,
   JSONServiceTokenSchema,
   JSONTransactionTypeSchema,
   JSONUsernameSchema
} from '../../../../lib/schema/json';
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
                     username: JSONUsernameSchema,
                     password: JSONPasswordSchema.optional(),
                     serviceToken: JSONServiceTokenSchema,
                     amount: JSONAmountSchema,
                     type: JSONTransactionTypeSchema
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
         // Make sure if it's a loss or a hold a password is provided
         if (body.password === undefined && (body.type === 'hold' || body.type === 'loss')) {
            throw new APIError(APIErrorCode.BadRequest, {
               error: 'Money cant be taken off a user without the password'
            });
         }

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

         // Check that the service has enough money
         if (
            (body.type === 'win' || body.type === 'return') &&
            service.Account.balance.minus(body.amount).lessThan(0)
         ) {
            throw new APIError(APIErrorCode.BadRequest, {
               message: `${service.name} doesn't have enough money`
            });
         }

         // Ensure that the user exists
         const user = await ensureUserExists(body.username, tx, UserDefaultInclude);

         if (body.password) {
            // Ensure that user credentials are correct
            await ensureUserCredentialsMatch(body.username, body.password, tx);
         }

         // Make sure the send has enough in their account
         if (
            (body.type === 'loss' || body.type === 'hold') &&
            user.Account.balance.minus(body.amount).lessThan(0)
         ) {
            throw new APIError(APIErrorCode.BadRequest, {
               message: `${user.username} doesn't have enough money`
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

         // Bank takes a cut if debt is present and the pay is a win
         let debtRepayment = new Prisma.Decimal(0);
         if (body.type === 'win' && user.debt.greaterThan(0)) {
            const amount = new Prisma.Decimal(body.amount);
            debtRepayment = Prisma.Decimal.min(
               amount.mul(env.LOAN_REPAY).toDecimalPlaces(2),
               user.debt
            );

            // Get the bank from the database
            const bank = await ensureServiceExists(env.BANK_USERNAME, tx, ServicesDefaultInclude);

            // Make sure the bank has an account
            if (bank.Account === null || bank.account_id === null) {
               throw new APIError(APIErrorCode.InternalServerError);
            }

            await tx.accounts.update({
               where: { id: bank.account_id },
               data: { balance: { increment: debtRepayment } }
            });

            await tx.users.update({
               where: { username: body.username },
               data: { debt: { decrement: debtRepayment } }
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
                           balance: {
                              increment: new Prisma.Decimal(body.amount).minus(debtRepayment)
                           }
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
               type: body.type
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
