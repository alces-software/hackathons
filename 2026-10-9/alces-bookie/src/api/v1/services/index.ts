import { OpenAPIHono } from '@hono/zod-openapi';

import addService from './controllers/addService';
import deleteService from './controllers/deleteService';
import getAllServices from './controllers/getAllServices';
import getService from './controllers/getService';

export default new OpenAPIHono()
   .route('/:name', getService)
   .route('/', addService)
   .route('/', deleteService)
   .route('/', getAllServices);
