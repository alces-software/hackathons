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
import { JSONUsernameAndPasswordSchema } from '../../../../lib/schema/json';
import { ensureServiceExists } from '../../services/lib/helpers';
import { ServicesDefaultInclude } from '../../services/lib/includes';
import { ensureUserCredentialsMatch, ensureUserExists } from '../../users/lib/helpers';
import { UserDefaultInclude } from '../../users/lib/includes';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'post',
      path: '/',
      description: 'Remove a loan from a user',
      tags: ['Bank', 'Users'],
      request: {
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
            description: 'Loan removed successfully'
         },
         ...BadRequestErrorSchema,
         ...UnauthorisedErrorSchema,
         ...NotFoundErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const body = c.req.valid('json');

      await prisma.$transaction(async (tx) => {
         // Ensure the user exists
         const user = await ensureUserExists(body.username, tx, UserDefaultInclude);

         // Make sure the user credentials match
         await ensureUserCredentialsMatch(body.username, body.password, tx);

         // Make sure the user has enough money
         if (user.Account.balance.minus(body.amount).lessThan(0)) {
            throw new APIError(APIErrorCode.BadRequest, {
               error: `${user.username} does not have enough to pay that amount`
            });
         }

         // Check if the user has a debt
         if (user.debt.equals(0)) {
            throw new APIError(APIErrorCode.BadRequest, {
               error: `${user.username} has no debt to pay off`
            });
         }

         // Make sure the amount to pay off isn't more than the debt
         if (body.amount > user.debt.toNumber()) {
            throw new APIError(APIErrorCode.BadRequest, {
               error: `Debt isn't large enough for that amount`
            });
         }

         // Update user account
         await tx.users.update({
            where: { username: user.username },
            data: {
               debt: { decrement: body.amount },
               Account: {
                  update: {
                     data: {
                        balance: { decrement: body.amount }
                     }
                  }
               }
            }
         });

         // Get the bank from the database
         const bank = await ensureServiceExists(env.BANK_USERNAME, tx, ServicesDefaultInclude);

         // Make sure the bank has an account
         if (bank.Account === null || bank.account_id === null) {
            throw new APIError(APIErrorCode.InternalServerError);
         }

         // Update bank
         await tx.accounts.update({
            where: { id: bank.account_id },
            data: {
               balance: { increment: body.amount }
            }
         })

         // Get service information
         const service = await tx.services
            .findUnique({
               where: {
                  name: 'Loan'
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
         await tx.ledger.create({
            data: {
               sender_account_id: user.account_id,
               receiver_account_id: bank.account_id,
               service_id: service.id,
               amount: body.amount,
               created_at: new Date()
            }
         });
      });

      return c.body(null, 204);
   }
);
