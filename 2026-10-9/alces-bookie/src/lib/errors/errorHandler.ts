import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

import APIError, { APIErrorCode } from './apiError';
import {
   badRequestErrorResponse,
   conflictErrorResponse,
   internalServerErrorResponse,
   notFoundErrorResponse
} from './responses';

/**
 * Handles the error responses by the API in one place
 * @param c The hono context
 * @param error The thrown error so it can be handled
 * @returns The returned error response
 */
export default function handleErrors(c: Context, error: unknown) {
   if (error instanceof HTTPException) {
      switch (error.status) {
         case 400:
            return badRequestErrorResponse(c, error.message);
         case 404:
            return notFoundErrorResponse(c, error.message);
         case 409:
            return conflictErrorResponse(c, error.message);
         default:
            return internalServerErrorResponse(c, error);
      }
   }

   if (error instanceof APIError) {
      switch (error.code) {
         case APIErrorCode.BadRequest:
            return badRequestErrorResponse(
               c,
               `${error.message}${error.context ? `\nContext: ${error.context}` : ''}`
            );
         case APIErrorCode.NotFound:
            return notFoundErrorResponse(
               c,
               `${error.message}${error.context ? `\nContext: ${error.context}` : ''}`
            );
         case APIErrorCode.Conflict:
            return conflictErrorResponse(
               c,
               `${error.message}${error.context ? `\nContext: ${error.context}` : ''}`
            );
         default:
            return internalServerErrorResponse(c, error.error);
      }
   }

   return internalServerErrorResponse(c, error);
}
