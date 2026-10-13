import { OpenAPIHono } from '@hono/zod-openapi';

import addTransaction from './controllers/addTransaction';
import addUser from './controllers/addUser';
import deleteUser from './controllers/deleteUser';
import getAllUsers from './controllers/getAllUsers';
import getUser from './controllers/getUser';
import login from './controllers/login';

export default new OpenAPIHono()
   .route('/login', login)
   .route('/transaction', addTransaction)
   .route('/:username', getUser)
   .route('/', addUser)
   .route('/', deleteUser)
   .route('/', getAllUsers);
