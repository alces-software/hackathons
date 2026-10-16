import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { env } from '../../../../lib/env';
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
import { UserDefaultInclude } from '../lib/includes';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'post',
      path: '/',
      description: 'Transfer from one user to another',
      tags: ['Users', 'Transactions'],
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
                        .min(0, { error: 'Amount must be more than 0' })
                        .transform((value) => Number(value.toFixed(2)))
                  })
               }
            }
         }
      },
      responses: {
         200: {
            description: 'Transaction was successful',
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
      const { username } = c.req.valid('param');
      const body = c.req.valid('json');

      const transactionID = await prisma.$transaction(async (tx) => {
         // Calculate the transaction fee
         const transactionFee = Number((body.amount * env.USER_TRANSACTION_FEE).toFixed(2));

         // Ensure sender user exits
         const sender = await ensureUserExists(body.username, tx, UserDefaultInclude);

         // Ensure account credentials are correct
         await ensureUserCredentialsMatch(body.username, body.password, tx);

         // Make sure the send has enough in their account
         if (sender.Account.balance.minus(body.amount).lessThan(0)) {
            throw new APIError(APIErrorCode.BadRequest, {
               message: `${body.username} does not have enough to send to ${username}`
            });
         }

         // Take money off sender
         await tx.account.update({
            where: { id: sender.account_id },
            data: {
               balance: { decrement: body.amount }
            }
         });

         // Ensure destination user exists
         const receiver = await ensureUserExists(username, tx, {});

         // Update the receivers money
         await tx.account.update({
            where: { id: receiver.account_id },
            data: {
               balance: { increment: body.amount - transactionFee }
            }
         });

         // Update the bank
         await tx.users.update({
            where: {
               username: env.BANK_USERNAME
            },
            data: {
               Account: {
                  update: {
                     data: {
                        balance: { increment: transactionFee }
                     }
                  }
               }
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

         // Add ledger
         return await tx.ledger.create({
            data: {
               sender_account_id: sender.account_id,
               receiver_account_id: receiver.account_id,
               amount: body.amount,
               service_id: service.id,
               timestamp: new Date()
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
