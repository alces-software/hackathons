import { env } from '../../../../lib/env';
import APIError, { APIErrorCode } from '../../../../lib/errors/apiError';

/**
 * Performs a transaction on the bank for a service
 * @param username The username of the user to transact for
 * @param password The password of the user to transact for
 * @param amount The amount to transact
 * @param type The type of transaction to perform
 * @returns If the transaction was successful
 */
export async function bankTransaction(
   username: string,
   password: string,
   amount: number,
   type: 'hold' | 'return'
) {
   const apiUrl = new URL('services/transaction', env.BANK_API);

   const payload = {
      username,
      password,
      serviceToken: env.SERVICE_TOKEN,
      amount,
      type
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
         message:
            type === 'hold'
               ? 'You do not have enough money for this transaction'
               : 'The held money for the bounty could not be returned'
      });
   } else {
      throw new APIError(APIErrorCode.InternalServerError, {
         error: `HTTP error: ${response.status}`
      });
   }
}

/**
 * Takes money from a user and holds it for the service
 * @param username The username of the user to take the money from
 * @param password The password of the user to take the money from
 * @param amount The amount to take
 * @returns If the money was taken
 */
export async function takeMoney(username: string, password: string, amount: number) {
   return bankTransaction(username, password, amount, 'hold');
}

/**
 * Returns money held by the service back to the user
 * @param username The username of the user to return the money to
 * @param password The password of the user to return the money to
 * @param amount The amount to return
 * @returns If the money was returned
 */
export async function returnMoney(username: string, password: string, amount: number) {
   return bankTransaction(username, password, amount, 'return');
}
