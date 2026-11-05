import { OpenAPIHono } from '@hono/zod-openapi';

import addAchievement from './controller/addAchievement';
import addLoan from './controller/addLoan';
import getBank from './controller/getBank';
import getFees from './controller/getFees';
import removeLoan from './controller/removeLoan';

export default new OpenAPIHono()
   .route('/achievement', addAchievement)
   .route('/loan', addLoan)
   .route('/fees', getFees)
   .route('/repay', removeLoan)
   .route('/', getBank);
