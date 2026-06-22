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
         const { id, achievement } = req.body || {};

         if (!id) {
            return res.status(400).json({
               success: false,
               error: 'You must provide a users id',
            });
         }

         if (!achievement) {
            return res.status(400).json({
               success: false,
               error: 'you must provided an achimenes id',
            });
         }

         await conn
            .query(
               'SELECT COUNT(*) AS total from user_achievements WHERE user_id = ? AND achievement_id = ?',
               [id, achievement],
            )
            .then((res) => {
               if (parseInt(res[0].total.toString()) === 1) {
                  return res.status(409).json({
                     success: false,
                     error: 'the user already has this achievement',
                  });
               }
            });

         await conn.query(
            'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
            [id, achievement],
         );

         return res.status(200).json({
            success: true,
         });
      } catch (err) {
         return res.status(500).json({
            success: false,
            error: err.message,
         });
      }
   };
};
