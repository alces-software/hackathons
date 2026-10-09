// LOAD ENV FILE
import 'dotenv/config';

// CREATE HONO
import { OpenAPIHono } from '@hono/zod-openapi';
const hono = new OpenAPIHono();

// LOAD MIDDLEWARE
import { cors } from 'hono/cors';
hono.use(
   '*',
   cors({
      allowMethods: ['POST', 'GET', 'DELETE', 'PATCH', 'OPTIONS']
   })
);

import { trimTrailingSlash } from 'hono/trailing-slash';
hono.use('*', trimTrailingSlash());

import { compress } from 'hono/compress';
hono.use('*', compress());

import { debugLogger } from './lib/middleware/debugLogger';
hono.use('*', debugLogger);

// LOAD V1 ENDPOINTS
import v1 from './api/v1';
hono.route('/api/v1', v1);

// CREATE ENDPOINT DOCS
hono.get('/api/v1/openapi.json', (c) => {
   return c.json(
      v1.getOpenAPI31Document({
         openapi: '3.1.0',
         info: {
            title: 'Alces Blueprint Logical Core',
            version: '1.0.0'
         },
         servers: [
            {
               url: '/api/v1'
            }
         ]
      })
   );
});

// HOST API DOCS
import { Scalar } from '@scalar/hono-api-reference';
hono.get(
   '/api/v1/docs',
   Scalar({
      pageTitle: 'Alces Bookie',
      url: '/api/v1/openapi.json'
   })
);

// HANDLE ERRORS
import handleErrors from './lib/errors/errorHandler';
hono.onError((error, c) => handleErrors(c, error));
hono.notFound((c) => {
   return c.body(`Looks like you have no money, LOL.`, 404);
});

// START UP SERVER
import { serve } from '@hono/node-server';
serve({
   fetch: hono.fetch,
   port: Number(process.env.PORT) || 3000
});
