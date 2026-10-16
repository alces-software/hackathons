import { OpenAPIHono } from '@hono/zod-openapi';

import getUsers from './controllers/getUsers';

export default new OpenAPIHono().route('/', getUsers);
