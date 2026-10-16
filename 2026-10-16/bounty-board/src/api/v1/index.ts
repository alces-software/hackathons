import { OpenAPIHono } from '@hono/zod-openapi';

import bounties from './bounties';
import users from './users';

export default new OpenAPIHono().route('/bounties', bounties).route('/users', users);
