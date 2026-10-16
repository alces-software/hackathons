import { OpenAPIHono } from '@hono/zod-openapi';

import addLoan from './controller/addLoan';
import getBank from './controller/getBank';
import getFees from './controller/getFees';
import removeLoan from './controller/removeLoan';

export default new OpenAPIHono()
   .route('/loan', addLoan)
   .route('/fees', getFees)
   .route('/repay', removeLoan)
   .route('/', getBank);
