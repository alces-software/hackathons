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
         const { title, description } = req.body || {};

         if (!title) {
            return res.status(400).json({
               success: false,
               error: 'you must provided a title',
            });
         }

         if (!description) {
            return res.status(400).json({
               success: false,
               error: 'you must provide a description',
            });
         }

         const results = await conn.query(
            'INSERT INTO achievements (title, description) VALUE (?,?)',
            [title, description],
         );

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
