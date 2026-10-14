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
import { ensureServiceExistsToken } from '../lib/helpers';

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
         204: {
            description: 'Successfully created a transaction'
         },
         ...BadRequestErrorSchema,
         ...UnauthorisedErrorSchema,
         ...NotFoundErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const body = c.req.valid('json');

      await transactionWithRetry(async (tx) => {
         // Ensure the service exists
         const service = await ensureServiceExistsToken(body.serviceToken, tx, {});

         // Ensure that the user exists
         const user = await ensureUserExists(body.username, tx, {});

         // Ensure that user credentials are correct
         await ensureUserCredentialsMatch(body.username, body.password, tx);

         // Make sure the send has enough in their account
         if (
            (body.type === 'loss' || body.type === 'hold') &&
            user.balance.minus(body.amount).lessThan(0)
         ) {
            throw new APIError(APIErrorCode.BadRequest, {
               message: `${user.username} does not have enough to transfer`
            });
         }

         // Update service
         await tx.services.update({
            where: { token: body.serviceToken },
            data: {
               ...((body.type === 'win' || body.type === 'return') && {
                  balance: { decrement: body.amount }
               }),
               ...((body.type === 'loss' || body.type === 'hold') && {
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

            await tx.users.update({
               where: { username: env.BANK_USERNAME },
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
                  balance: { increment: body.amount },
                  winnings: { increment: body.amount }
               }),
               ...(body.type === 'loss' && {
                  balance: { decrement: body.amount },
                  loses: { increment: body.amount }
               }),
               ...(body.type === 'hold' && {
                  balance: { decrement: body.amount }
               }),
               ...(body.type === 'return' && {
                  balance: { increment: body.amount }
               })
            }
         });

         // Add ledger transaction
         if (body.type === 'win' || body.type === 'loss') {
            await tx.ledger.create({
               data: {
                  username: user.username,
                  service: service.id,
                  beforeBalance: user.balance,
                  afterBalance:
                     body.type === 'win'
                        ? user.balance.plus(body.amount)
                        : user.balance.minus(body.amount),
                  timestamp: new Date()
               }
            });
         }
      });

      // Update the websocket
      publish({
         type: 'content.created',
         id: 'transactions',
         timestamp: new Date().toISOString()
      });

      return c.body(null, 204);
   }
);
