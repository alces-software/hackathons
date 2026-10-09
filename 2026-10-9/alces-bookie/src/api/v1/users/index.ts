import { OpenAPIHono } from '@hono/zod-openapi';

import addUser from './controllers/addUser';
import deleteUser from './controllers/deleteUser';

export default new OpenAPIHono().route('/', addUser).route('/', deleteUser);
