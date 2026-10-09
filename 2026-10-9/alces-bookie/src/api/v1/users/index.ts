import { OpenAPIHono } from '@hono/zod-openapi';

import addUser from './controllers/addUser';
import deleteUser from './controllers/deleteUser';
import getAllUsers from './controllers/getAllUsers';
import getUser from './controllers/getUser';

export default new OpenAPIHono()
   .route('/:username', getUser)
   .route('/', addUser)
   .route('/', deleteUser)
   .route('/', getAllUsers);
