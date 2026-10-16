import { env } from '../../../../lib/env';
import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';

export async function takeMoney(username: string, password: string, amount: number) {
   const apiUrl = new URL('services/transaction', env.BANK_API);

   const payload = {
      username,
      password,
      serviceToken: env.SERVICE_TOKEN,
      amount,
      type: 'hold'
   };

   const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
   });

   console.log(await response.text());

   if (response.status === 200) {
      return true;
   } else if (response.status === 401 || response.status === 404) {
      return false;
   } else if (response.status === 400) {
      throw new APIError(APIErrorCode.BadRequest, {
         message: 'You do not have enough money for this transaction'
      });
   } else {
      throw new APIError(APIErrorCode.InternalServerError, {
         error: `HTTP error: ${response.status}`
      });
   }
}
