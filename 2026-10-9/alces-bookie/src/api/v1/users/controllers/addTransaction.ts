import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';
import {
   BadRequestErrorSchema,
   InternalServerErrorSchema,
   NotFoundErrorSchema,
   UnauthorisedErrorSchema
} from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { publish } from '../../../../lib/publisher';
import { JSONUsernameAndPasswordSchema } from '../../../../lib/schema/json';
import { UsernameParamSchema } from '../../../../lib/schema/param';
import { ensureUserCredentialsMatch, ensureUserExists } from '../lib/helpers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'post',
      path: '/',
      description: 'Transfer from one user to another',
      tags: ['users', 'Transactions'],
      request: {
         params: z.object({
            ...UsernameParamSchema
         }),
         body: {
            content: {
               'application/json': {
                  schema: z.object({
                     ...JSONUsernameAndPasswordSchema,
                     amount: z
                        .number({ error: 'Amount must be a number' })
                        .min(1, { error: 'Amount must be more than 0' })
                        .transform((value) => Number(value.toFixed(2)))
                  })
               }
            }
         }
      },
      responses: {
         204: {
            description: 'Transaction was successful'
         },
         ...NotFoundErrorSchema,
         ...UnauthorisedErrorSchema,
         ...BadRequestErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const { username } = c.req.valid('param');
      const body = c.req.valid('json');

      await prisma.$transaction(async (tx) => {
         // Calculate the transaction fee
         const transactionFee = Number(
            (body.amount * Number(process.env.USER_TRANSACTION_FEE ?? 0)).toFixed(2)
         );

         // Ensure sender user exits
         const sender = await ensureUserExists(body.username, tx, {});

         // Ensure account credentials are correct
         await ensureUserCredentialsMatch(body.username, body.password, tx);

         // Make sure the send has enough in their account
         if (sender.balance.minus(body.amount).lessThan(0)) {
            throw new APIError(APIErrorCode.BadRequest, {
               message: `${body.username} does not have enough to send to ${username}`
            });
         }

         // Take money off sender
         await tx.users.update({
            where: {
               username: sender.username
            },
            data: {
               balance: { decrement: body.amount }
            }
         });

         // Ensure destination user exists
         const receiver = await ensureUserExists(username, tx, {});

         // Update the receivers money
         await tx.users.update({
            where: {
               username: receiver.username
            },
            data: {
               balance: { increment: body.amount - transactionFee }
            }
         });

         // Update the bank
         await tx.users.update({
            where: {
               username: process.env.BANK_USERNAME ?? 'bank'
            },
            data: {
               balance: { increment: transactionFee }
            }
         });

         // Get service information
         const service = await tx.services
            .findUnique({
               where: {
                  name: 'Transfer'
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

         // Add sender ledger
         await tx.ledger.create({
            data: {
               username: sender.username,
               service: service?.id,
               beforeBalance: sender.balance,
               afterBalance: sender.balance.minus(body.amount),
               timestamp: new Date()
            }
         });

         // Add receiver ledger
         await tx.ledger.create({
            data: {
               username: receiver.username,
               service: service?.id,
               beforeBalance: receiver.balance,
               afterBalance: receiver.balance.plus(body.amount - transactionFee),
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
