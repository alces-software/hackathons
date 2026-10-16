import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { authenticate } from '../../../../lib/auth';
import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';
import { InternalServerErrorSchema, UnauthorisedErrorSchema } from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { bountyReturnSchema } from '../lib/schemas';
import { serializeBounty } from '../lib/serializers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'post',
      path: '/',
      description: 'Create new bounty',
      tags: ['Bounty'],
      request: {
         body: {
            content: {
               'application/json': {
                  schema: z.object({
                     username: z.string(),
                     password: z.string(),
                     title: z.string(),
                     description: z.string(),
                     price: z.number()
                  })
               }
            }
         }
      },
      responses: {
         201: {
            description: 'Created bounty',
            content: {
               'application/json': {
                  schema: bountyReturnSchema
               }
            }
         },
         ...InternalServerErrorSchema,
         ...UnauthorisedErrorSchema
      }
   }),
   async (c) => {
      const { username, password, title, description, price } = c.req.valid('json');
      // Authenticate user
      const isAuth = await authenticate(username, password);

      if (!isAuth) {
         throw new APIError(APIErrorCode.Unauthorised, { message: 'Could not authorize user' });
      }

      // Take money through hold

      // Create bounty table

      const newBounty = await prisma.bounty.create({
         data: {
            patron: username,
            price,
            title,
            description,
            startTime: new Date()
         }
      });

      return c.json(serializeBounty(newBounty), 201);
   }
);
