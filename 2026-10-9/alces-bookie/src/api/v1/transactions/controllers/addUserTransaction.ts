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
import { ensureAccountCredentialsMatch, ensureAccountExists } from '../../users/lib/helpers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'post',
      path: '/',
      description: 'Transfer from one user to another',
      tags: ['Transactions'],
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
         // Ensure sender user exits
         const sender = await ensureAccountExists(body.username, tx, {});

         // Ensure account credentials are correct
         await ensureAccountCredentialsMatch(body.username, body.password, tx);

         // Make sure the send has enough in their account
         if (sender.balance.minus(body.amount).lessThan(0)) {
            throw new APIError(APIErrorCode.BadRequest, {
               message: `${body.username} does not have enough to send to ${username}`
            });
         }

         // Take monet off sender
         await tx.accounts.update({
            where: {
               username: sender.username
            },
            data: {
               balance: sender.balance.minus(body.amount)
            }
         });

         // Calculate banks take
         const banksCut = Number(
            (body.amount * Number(process.env.TRANSACTION_FEE ?? 0)).toFixed(2)
         );

         // Ensure destination user exists
         const receiver = await ensureAccountExists(username, tx, {});

         // Update the receivers money
         await tx.accounts.update({
            where: {
               username: receiver.username
            },
            data: {
               balance: receiver.balance.plus(body.amount - banksCut)
            }
         });

         // Get the bank information
         const bank = await ensureAccountExists(process.env.BANK_USERNAME ?? 'bank', tx, {});

         // Update the bank
         await tx.accounts.update({
            where: {
               username: bank.username
            },
            data: {
               balance: bank.balance.plus(banksCut)
            }
         });

         // Get service information
         const service = await tx.services
            .findUnique({
               where: {
                  name: 'transfer'
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
               afterBalance: receiver.balance.plus(body.amount - banksCut),
               timestamp: new Date()
            }
         });
      });

      // Everyone watching the book should see the new entries.
      publish({
         type: 'content.created',
         id: 'transactions',
         timestamp: new Date().toISOString()
      });

      return c.body(null, 204);
   }
);
