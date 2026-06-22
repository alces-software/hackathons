require('dotenv').config();

const express = require('express');
const mariadb = require('mariadb');

(async () => {
   const app = express();

   app.use(express.json());

   /* -------------------- MariaDB Connection -------------------- */
   const pool = mariadb.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 5,
   });

   const conn = await pool.getConnection();

   /* ------------------------- Endpoints ------------------------- */

   app.use('/', require('./endpoints/user/router')(conn));
   app.use('/', require('./endpoints/achievement/route')(conn));

   /* ----------------------- Start Server ----------------------- */
   const server = app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
      console.log(`API running on port ${process.env.PORT || 3000}`);
   });

   /* -------------------- Graceful Shutdown --------------------- */
   async function shutdown() {
      console.log('Shutting down...');

      server.close(async () => {
         try {
            await pool.end();
            console.log('MariaDB pool closed');
            process.exit(0);
         } catch (err) {
            console.error('Error closing pool', err);
            process.exit(1);
         }
      });
   }

   process.on('SIGINT', shutdown);
   process.on('SIGTERM', shutdown);
})();
