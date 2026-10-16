import { OpenAPIHono } from '@hono/zod-openapi';

import completeBounty from './controllers/completeBounty';
import createBounty from './controllers/createBounty';
import getBounties from './controllers/getBounties';

export default new OpenAPIHono()
   .route('/', createBounty)
   .route('/', completeBounty)
   .route('/', getBounties);
