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
import { ensureUserCredentialsMatch, ensureUserExists } from '../../users/lib/helpers';

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
         ...NotFoundErrorSchema,
         ...UnauthorisedErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const body = c.req.valid('json');

      await prisma.$transaction(async (tx) => {
         // Ensure the user exists
         const user = await ensureUserExists(body.username, tx, {});

         // Make sure the user credentials match
         await ensureUserCredentialsMatch(body.username, body.password, tx);

         // Make sure the user has enough money
         if (user.balance.minus(body.amount).lessThan(0)) {
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

         // Get the bank from the database
         const bank = await ensureUserExists(process.env.BANK_USERNAME ?? 'bank', tx, {});

         // Update user account
         await tx.users.update({
            where: { username: user.username },
            data: {
               balance: { decrement: body.amount },
               debt: { decrement: body.amount }
            }
         });

         // Update bank
         await tx.users.update({
            where: {
               username: bank.username
            },
            data: {
               balance: { increment: body.amount }
            }
         });
      });

      return c.body(null, 204);
   }
);
