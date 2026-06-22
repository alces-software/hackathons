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
         const { username } = req.body || {};

         if (!username) {
            return res.status(400).json({
               success: false,
               error: 'you must provided the name of the user to add',
            });
         }

         const results = await conn.query('INSERT INTO users (username) VALUES (?)', [username]);

         return res.status(200).json({
            success: true,
            data: results.insertId.toString(),
         });
      } catch (err) {
         return res.status(500).json({
            success: false,
            error: err.message,
         });
      }
   };
};
