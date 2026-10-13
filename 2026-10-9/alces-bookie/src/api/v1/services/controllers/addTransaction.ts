import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';
import { ConflictErrorSchema, InternalServerErrorSchema } from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { publish } from '../../../../lib/publisher';
import { JSONUsernameAndPasswordSchema } from '../../../../lib/schema/json';
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
                        .min(1, { error: 'Amount must be more than 0' })
                        .transform((value) => Number(value.toFixed(2))),
                     type: z.enum(['win', 'loss'], {
                        error: 'The type must be either a win or a loss'
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
         ...ConflictErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const body = c.req.valid('json');

      await prisma.$transaction(async (tx) => {
         // Ensure the service exists
         const service = await ensureServiceExistsToken(body.serviceToken, tx, {});

         // Ensure that the user exists
         const user = await ensureUserExists(body.username, tx, {});

         // Ensure that user credentials are correct
         await ensureUserCredentialsMatch(body.username, body.password, tx);

         // Make sure the send has enough in their account
         if (body.type === 'loss' && user.balance.minus(body.amount).lessThan(0)) {
            throw new APIError(APIErrorCode.BadRequest, {
               message: `${user.username} does not have enough to transfer`
            });
         }

         // Update user
         await tx.users.update({
            where: { username: body.username },
            data: {
               ...(body.type === 'win'
                  ? {
                       balance: { increment: body.amount },
                       winnings: { increment: body.amount }
                    }
                  : {
                       balance: { decrement: body.amount },
                       loses: { increment: body.amount }
                    })
            }
         });

         // Update service
         await tx.services.update({
            where: { token: body.serviceToken },
            data: {
               balance:
                  body.type === 'win' ? { decrement: body.amount } : { increment: body.amount }
            }
         });

         // Add ledger transaction
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
