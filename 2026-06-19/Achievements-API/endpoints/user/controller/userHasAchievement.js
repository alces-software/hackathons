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
         const { id, achievement } = req.query || {};

         if (!id) {
            return res.status(400).json({
               success: false,
               error: 'you must provided a user id',
            });
         }

         if (!achievement) {
            return res.status(400).json({
               success: false,
               error: 'you must provided a achievement id',
            });
         }

         const results = await conn.query(
            'SELECT user_id FROM user_achievements WHERE achievement_id = ? AND user_id = ?',
            [achievement, id],
         );

         if (results.length === 0) {
            return res.status(200).json({
               success: true,
               data: false,
            });
         } else {
            return res.status(200).json({
               success: true,
               data: true,
            });
         }
      } catch (err) {
         return res.status(500).json({
            success: false,
            error: err.message,
         });
      }
   };
};
