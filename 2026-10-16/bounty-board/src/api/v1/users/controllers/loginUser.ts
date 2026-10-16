import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authenticate } from '../../../../lib/auth';
import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';
import {
   BadRequestErrorSchema,
   InternalServerErrorSchema,
   UnauthorisedErrorSchema
} from '../../../../lib/errors/schemas';
import { loginRequestSchema, loginReturnSchema } from '../lib/schemas';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'post',
      path: '/login',
      description: 'Log in to the bank',
      tags: ['Users'],
      request: {
         body: {
            content: {
               'application/json': {
                  schema: loginRequestSchema
               }
            }
         }
      },
      responses: {
         200: {
            description: 'Logged in successfully',
            content: {
               'application/json': {
                  schema: loginReturnSchema
               }
            }
         },
         ...BadRequestErrorSchema,
         ...UnauthorisedErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const { username, password } = c.req.valid('json');

      // Authenticate user against the bank
      const isAuth = await authenticate(username, password);

      if (!isAuth) {
         throw new APIError(APIErrorCode.Unauthorised, { message: 'Could not authorize user' });
      }

      return c.json({ message: 'Login successful' }, 200);
   }
);
