import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { authenticate } from '../../../../lib/auth';
import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';
import {
   BadRequestErrorSchema,
   ConflictErrorSchema,
   ForbiddenErrorSchema,
   InternalServerErrorSchema,
   NotFoundErrorSchema,
   UnauthorisedErrorSchema
} from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { returnMoney } from '../lib/helpers';
import { bountyReturnSchema } from '../lib/schemas';
import { serializeBounty } from '../lib/serializers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'patch',
      path: '/{id}/complete',
      description: 'Complete a bounty, paying out the held money to the patron',
      tags: ['Bounty'],
      request: {
         params: z.object({
            id: z.coerce.number().int().positive().meta({
               description: 'The id of the bounty to complete',
               example: '1'
            })
         }),
         body: {
            content: {
               'application/json': {
                  schema: z.object({
                     username: z.string(),
                     password: z.string()
                  })
               }
            }
         }
      },
      responses: {
         200: {
            description: 'Completed bounty',
            content: {
               'application/json': {
                  schema: bountyReturnSchema
               }
            }
         },
         ...BadRequestErrorSchema,
         ...ConflictErrorSchema,
         ...ForbiddenErrorSchema,
         ...NotFoundErrorSchema,
         ...UnauthorisedErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const { id } = c.req.valid('param');
      const { username, password } = c.req.valid('json');

      // Authenticate user
      const isAuth = await authenticate(username, password);

      if (!isAuth) {
         throw new APIError(APIErrorCode.Unauthorised, { message: 'Could not authorize user' });
      }

      // Find the bounty
      const bounty = await prisma.bounty.findUnique({
         where: { id }
      });

      if (!bounty) {
         throw new APIError(APIErrorCode.NotFound, { message: 'The bounty does not exist' });
      }

      // Check the bounty is not already completed
      if (bounty.endTime) {
         throw new APIError(APIErrorCode.Conflict, { message: 'The bounty is already completed' });
      }

      // Check the user is the bounty's patron
      if (bounty.patron !== username) {
         throw new APIError(APIErrorCode.Forbidden, {
            message: 'Only the patron of the bounty can complete it'
         });
      }

      // Return the held money to the patron
      const returnedMoney = await returnMoney(username, password, bounty.price.toNumber());

      if (!returnedMoney) {
         throw new APIError(APIErrorCode.InternalServerError, {
            error: 'Could not return money to the patron'
         });
      }

      // Mark the bounty as completed
      const completedBounty = await prisma.bounty.update({
         where: { id },
         data: {
            endTime: new Date()
         }
      });

      return c.json(serializeBounty(completedBounty), 200);
   }
);
