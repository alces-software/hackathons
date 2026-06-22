/**
 * @param {import('mariadb').Connection} conn
 * @returns {(req: import('express').Request, res: import('express').Response) => Promise<void>}
 */
module.exports = (conn) => {
   /**
    * @param {import('express').Request} req
    * @param {import('express').Response} res
    * @returns {Promise<void>}
    */
   return async (req, res) => {
      try {
         const { username } = req.query || {};

         if (!username) {
            return res.status(400).json({
               success: false,
               error: 'you must provide a username',
            });
         }

         const results = await conn.query('SELECT id FROM users WHERE username = ? LIMIT 1', [
            username,
         ]);

         if (results.length === 0) {
            return res.status(404).json({
               success: false,
               error: 'no user in the database with that username',
            });
         }

         return res.status(200).json({
            success: true,
            data: results[0].id.toString(),
         });
      } catch (err) {
         return res.status(500).json({
            success: false,
            error: err.message,
         });
      }
   };
};
