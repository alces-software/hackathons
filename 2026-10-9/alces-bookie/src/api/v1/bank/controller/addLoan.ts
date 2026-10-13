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
      description: 'Add a loan to a user',
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
            description: 'Loan added successfully'
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

         // Check that the user can get more of a loan
         if (
            user.debt.toNumber() === 1000 ||
            user.debt.plus(body.amount).greaterThan(Number(process.env.DEBT_LIMIT ?? 1000))
         ) {
            throw new APIError(APIErrorCode.BadRequest, {
               message: `${body.username} has hit the debt limit and can't get a loan for anyone without repaying previous loans`
            });
         }

         // Get the bank from the database
         const bank = await ensureUserExists(process.env.BANK_USERNAME ?? 'bank', tx, {});

         // Check that the bank can perform the loan
         if (bank.balance.minus(body.amount).lessThan(0)) {
            throw new APIError(APIErrorCode.BadRequest, {
               message: 'The bank cannot fund this loan at the moment'
            });
         }

         // Update users account
         await tx.users.update({
            where: { username: user.username },
            data: {
               balance: { increment: body.amount },
               debt: { increment: body.amount }
            }
         });

         // Update bank
         await tx.users.update({
            where: {
               username: bank.username
            },
            data: {
               balance: { decrement: body.amount }
            }
         });
      });

      return c.body(null, 204);
   }
);
