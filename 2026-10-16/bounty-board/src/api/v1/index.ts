import { OpenAPIHono } from '@hono/zod-openapi';

import bounties from './bounties';

export default new OpenAPIHono().route('/bounties', bounties);
