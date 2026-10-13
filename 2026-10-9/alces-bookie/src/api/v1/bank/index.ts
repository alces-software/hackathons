import { OpenAPIHono } from '@hono/zod-openapi';

import addLoan from './controller/addLoan';
import removeLoan from './controller/removeLoan';

export default new OpenAPIHono().route('/loan', addLoan).route('/repay', removeLoan);
