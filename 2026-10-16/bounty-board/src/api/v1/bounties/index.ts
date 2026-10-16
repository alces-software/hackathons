import { OpenAPIHono } from '@hono/zod-openapi';

import createBounty from './controllers/createBounty';

export default new OpenAPIHono().route('/', createBounty);
