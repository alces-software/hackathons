import { OpenAPIHono } from '@hono/zod-openapi';

import getAllTransactions from './controllers/getAllTransactions';
import getTransaction from './controllers/getTransaction';

export default new OpenAPIHono().route('/:id', getTransaction).route('/', getAllTransactions);
