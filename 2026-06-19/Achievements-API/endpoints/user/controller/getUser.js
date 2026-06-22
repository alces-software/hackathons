const normaliseRow = require('../../../tools/normalizeRow');

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
         const { id, username } = req.query || {};

         if (id && username) {
            return res.status(400).json({
               success: false,
               error: 'Provide either id or username, not both',
            });
         }

         if (!id && !username) {
            return res.status(400).json({
               success: false,
               error: 'You must provide either id or username',
            });
         }

         let query = 'SELECT * FROM users WHERE ';
         let params = [];

         if (id) {
            query += 'id = ?';
            params.push(id);
         } else {
            query += 'username = ?';
            params.push(username);
         }

         const rows = await conn.query(query, params);

         if (rows.length === 0) {
            return res.status(404).json({
               success: false,
               error: 'User not found',
            });
         }

         return res.json({
            success: true,
            data: normaliseRow(rows[0]),
         });
      } catch (err) {
         return res.status(500).json({
            success: false,
            error: err.message,
         });
      }
   };
};
