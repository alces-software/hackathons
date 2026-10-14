// CREATE HONO
import { serve, upgradeWebSocket } from '@hono/node-server';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { trimTrailingSlash } from 'hono/trailing-slash';
import { WebSocketServer } from 'ws';

import v1 from './api/v1';
import { env } from './lib/env';
import handleErrors from './lib/errors/errorHandler';
import { debugLogger } from './lib/middleware/debugLogger';
import { addClient, removeClient } from './lib/publisher';
const hono = new OpenAPIHono();

// LOAD MIDDLEWARE
hono.use(
   '*',
   cors({
      allowMethods: ['POST', 'GET', 'DELETE', 'PATCH', 'OPTIONS']
   })
);
hono.use('*', trimTrailingSlash());
hono.use('*', compress());
hono.use('*', debugLogger);

// LOAD V1 ENDPOINTS
hono.route('/api/v1', v1);

// CREATE ENDPOINT DOCS
hono.get('/api/v1/openapi.json', (c) => {
   return c.json(
      v1.getOpenAPI31Document({
         openapi: '3.1.0',
         info: {
            title: 'Alces Bookie',
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
hono.get(
   '/api/v1/docs',
   Scalar({
      pageTitle: 'Alces Bookie',
      url: '/api/v1/openapi.json'
   })
);

hono.get(
   '/api/v1/ws',
   upgradeWebSocket(() => ({
      onOpen(_event, ws) {
         addClient(ws);
      },
      onClose(_event, ws) {
         removeClient(ws);
      },
      onError(_event, ws) {
         removeClient(ws);
      }
   }))
);

// HANDLE ERRORS
hono.onError((error, c) => handleErrors(c, error));
hono.notFound((c) => {
   return c.body(`Looks like you have no money, LOL.`, 404);
});

// START UP SERVER
const wss = new WebSocketServer({ noServer: true });

serve({
   fetch: hono.fetch,
   websocket: { server: wss },
   port: env.PORT
});
