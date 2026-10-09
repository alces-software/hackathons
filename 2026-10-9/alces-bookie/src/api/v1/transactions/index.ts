import { OpenAPIHono } from '@hono/zod-openapi';

import addTransaction from './controllers/addTransaction';
import getAllTransactions from './controllers/getAllTransactions';
import getTransaction from './controllers/getTransaction';

export default new OpenAPIHono()
   .route('/:username', addTransaction)
   .route('/:id', getTransaction)
   .route('/', getAllTransactions);
