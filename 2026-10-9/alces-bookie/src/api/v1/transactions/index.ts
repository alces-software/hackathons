import { OpenAPIHono } from '@hono/zod-openapi';

import addServiceTransaction from './controllers/addServiceTransaction';
import getAllTransactions from './controllers/getAllTransactions';
import getTransaction from './controllers/getTransaction';

export default new OpenAPIHono()
   .route('/service/:username', addServiceTransaction)
   .route('/:id', getTransaction)
   .route('/', getAllTransactions);
