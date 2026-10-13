import { OpenAPIHono } from '@hono/zod-openapi';

import bank from './bank';
import services from './services';
import transactions from './transactions';
import users from './users';

export default new OpenAPIHono()
   .route('/bank', bank)
   .route('/services', services)
   .route('/transactions', transactions)
   .route('/users', users);
