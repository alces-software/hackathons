import { randomBytes } from 'node:crypto';

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { env } from '../../../../lib/env';
import { ConflictErrorSchema, InternalServerErrorSchema } from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { ensureServiceDoesntExist } from '../lib/helpers';

export default new OpenAPIHono().openapi(
   createRoute({
      method: 'post',
      path: '/',
      description: 'Create a service',
      tags: ['Services'],
      request: {
         body: {
            content: {
               'application/json': {
                  schema: z.object({
                     name: z
                        .string({ error: 'Name must be a string' })
                        .trim()
                        .min(4, { error: 'Name must be more than 4 characters' })
                        .max(25, { error: 'Name cannot be more than 25 characters' })
                  })
               }
            }
         }
      },
      responses: {
         201: {
            description: 'Created a service successfully',
            content: {
               'application/json': {
                  schema: z.object({
                     id: z.int(),
                     name: z.string(),
                     token: z.string()
                  })
               }
            }
         },
         ...ConflictErrorSchema,
         ...InternalServerErrorSchema
      }
   }),
   async (c) => {
      const body = c.req.valid('json');

      const newAsset = await prisma.$transaction(async (tx) => {
         // Check to make sure the service doesnt already exist
         await ensureServiceDoesntExist(body.name, tx);

         // Create the service
         return await tx.services.create({
            data: {
               name: body.name,
               token: randomBytes(16).toString('hex'),
               Account: {
                  create: {
                     balance: env.SERVICE_START_CASH
                  }
               }
            }
         });
      });

      return c.json(
         {
            id: newAsset.id,
            name: newAsset.name!,
            token: newAsset.token
         },
         201
      );
   }
);
