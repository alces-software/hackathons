import { OpenAPIHono } from '@hono/zod-openapi';

import addServiceTransaction from './controllers/addServiceTransaction';
import addUserTransaction from './controllers/addUserTransaction';
import getAllTransactions from './controllers/getAllTransactions';
import getTransaction from './controllers/getTransaction';

export default new OpenAPIHono()
   .route('/service/:user', addServiceTransaction)
   .route('/:username', addUserTransaction)
   .route('/:id', getTransaction)
   .route('/', getAllTransactions);
