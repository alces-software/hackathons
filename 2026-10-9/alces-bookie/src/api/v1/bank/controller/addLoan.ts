import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { env } from '../../../../lib/env';
import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';
import {
   BadRequestErrorSchema,
   InternalServerErrorSchema,
   NotFoundErrorSchema,
   UnauthorisedErrorSchema
} from '../../../../lib/errors/schemas';
import { JSONAmountSchema, JSONUsernameAndPasswordSchema } from '../../../../lib/schema/json';
import { transactionWithRetry } from '../../../../lib/transactionWithRetry';
import { ensureServiceExists } from '../../services/lib/helpers';
import { ServicesDefaultInclude } from '../../services/lib/includes';
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
                     amount: JSONAmountSchema
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
         ...UnauthorisedErrorSchema,
         ...NotFoundErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const body = c.req.valid('json');

      await transactionWithRetry(async (tx) => {
         // Ensure the user exists
         const user = await ensureUserExists(body.username, tx, {});

         // Make sure the user credentials match
         await ensureUserCredentialsMatch(body.username, body.password, tx);

         // Check that the user can get more of a loan
         if (
            user.debt.toNumber() === env.DEBT_LIMIT ||
            user.debt.plus(body.amount).greaterThan(env.DEBT_LIMIT)
         ) {
            throw new APIError(APIErrorCode.BadRequest, {
               message: `${body.username} has hit the debt limit and can't get a loan for anyone without repaying previous loans`
            });
         }

         // Get the bank from the database
         const bank = await ensureServiceExists(env.BANK_USERNAME, tx, ServicesDefaultInclude);

         // Make sure the bank has an account
         if (bank.Account === null || bank.account_id === null) {
            throw new APIError(APIErrorCode.InternalServerError);
         }

         // Check that the bank can perform the loan
         if (bank.Account.balance.minus(body.amount).lessThan(0)) {
            throw new APIError(APIErrorCode.BadRequest, {
               message: 'The bank cannot fund this loan at the moment'
            });
         }

         // Update users account
         await tx.users.update({
            where: { username: user.username },
            data: {
               debt: { increment: body.amount * (env.LOAN_INTEREST + 1) },
               Account: {
                  update: {
                     data: {
                        balance: { increment: body.amount }
                     }
                  }
               }
            }
         });

         // Update bank
         await tx.accounts.update({
            where: { id: bank.account_id },
            data: {
               balance: { decrement: body.amount }
            }
         });

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
               sender_account_id: bank.account_id,
               receiver_account_id: user.account_id,
               service_id: service.id,
               amount: body.amount,
               type: 'transfer'
            }
         });
      });

      return c.body(null, 204);
   }
);
