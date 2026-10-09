import type { WSContext } from 'hono/ws';

export type ChangeEvent = {
   type: 'content.created' | 'content.updated' | 'content.deleted';
   id: string;
   version?: number;
   timestamp: string;
};

const clients = new Set<WSContext>();

export function addClient(ws: WSContext) {
   clients.add(ws);
}

export function removeClient(ws: WSContext) {
   clients.delete(ws);
}

export function publish(event: ChangeEvent) {
   const message = JSON.stringify(event);

   for (const client of clients) {
      try {
         client.send(message);
      } catch (error) {
         // A broken connection should not prevent delivery to other clients.
         console.error('Failed to send WebSocket event:', error);
         clients.delete(client);
      }
   }
}

export function subscriberCount() {
   return clients.size;
}
