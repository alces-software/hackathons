import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';
import {
   BadRequestErrorSchema,
   InternalServerErrorSchema,
   NotFoundErrorSchema,
   UnauthorisedErrorSchema
} from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
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
         if (sender.balance - body.amount < 0) {
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
               balance: sender.balance - body.amount
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
               balance: receiver.balance + (body.amount - banksCut)
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
               balance: bank.balance + banksCut
            }
         });
      });

      return c.body(null, 204);
   }
);
