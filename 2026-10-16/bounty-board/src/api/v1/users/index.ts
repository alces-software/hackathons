import { OpenAPIHono } from '@hono/zod-openapi';

import getUsers from './controllers/getUsers';
import loginUser from './controllers/loginUser';

export default new OpenAPIHono().route('/', loginUser).route('/', getUsers);
