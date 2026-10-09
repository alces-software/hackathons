import { randomBytes } from 'node:crypto';

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { ConflictErrorSchema, InternalServerErrorSchema } from '../../../../lib/errors/schemas';
import { prisma } from '../../../../lib/prisma';
import { ensureAssetDoesntExist } from '../lib/helpers';

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
                     name: z.string().min(4).max(25).trim()
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
         await ensureAssetDoesntExist(body.name, tx);

         return await tx.services.create({
            data: {
               name: body.name,
               token: randomBytes(16).toString('hex')
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
