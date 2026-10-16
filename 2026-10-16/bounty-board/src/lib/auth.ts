import { env } from './env';
import APIError, { APIErrorCode } from './errors/apiError';

export async function authenticate(username: string, password: string): Promise<boolean> {
   const apiUrl = new URL('users/login', env.BANK_API);

   const payload = {
      username,
      password
   };

   const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
   });

   if (response.status === 204) {
      return true;
   } else if (response.status === 401 || response.status === 404) {
      return false;
   } else {
      throw new APIError(APIErrorCode.InternalServerError, {
         error: `HTTP error: ${response.status}`
      });
   }
}
