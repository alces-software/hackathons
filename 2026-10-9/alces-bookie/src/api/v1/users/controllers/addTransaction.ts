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
import { JSONAmountSchema, JSONUsernameAndPasswordSchema } from '../../../../lib/schema/json';
import { ParamUsernameSchema } from '../../../../lib/schema/param';
import { transactionWithRetry } from '../../../../lib/transactionWithRetry';
import { ensureServiceExists } from '../../services/lib/helpers';
import { ServicesDefaultInclude } from '../../services/lib/includes';
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
            username: ParamUsernameSchema
         }),
         body: {
            content: {
               'application/json': {
                  schema: z.object({
                     ...JSONUsernameAndPasswordSchema,
                     amount: JSONAmountSchema
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

      const transactionID = await transactionWithRetry(async (tx) => {
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
         await tx.accounts.update({
            where: { id: sender.account_id },
            data: {
               balance: { decrement: body.amount }
            }
         });

         // Ensure destination user exists
         const receiver = await ensureUserExists(username, tx, {});

         // Update the receivers money
         await tx.accounts.update({
            where: { id: receiver.account_id },
            data: {
               balance: { increment: body.amount - transactionFee }
            }
         });

         // Get the bank from the database
         const bank = await ensureServiceExists(env.BANK_USERNAME, tx, ServicesDefaultInclude);

         // Make sure the bank has an account
         if (bank.Account === null || bank.account_id === null) {
            throw new APIError(APIErrorCode.InternalServerError);
         }

         // Update the bank
         await tx.accounts.update({
            where: { id: bank.account_id },
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

         // Add ledger
         return await tx.ledger.create({
            data: {
               sender_account_id: sender.account_id,
               receiver_account_id: receiver.account_id,
               amount: body.amount,
               service_id: service.id,
               type: 'transfer'
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
