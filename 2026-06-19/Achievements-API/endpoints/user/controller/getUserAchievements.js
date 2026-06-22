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
         const { id } = req.query || {};

         if (!id) {
            return res.status(400).json({
               success: false,
               error: 'you must provided a user id',
            });
         }

         const results = await conn.query(
            `
               SELECT
                     a.id AS achievement_id,
                     a.title,
                     a.description,
                     ua.unlocked_at
               FROM user_achievements ua
               JOIN achievements a
                     ON ua.achievement_id = a.id
               WHERE ua.user_id = ?;
            `,
            [id],
         );

         const achievements = await conn.query('SELECT COUNT(*) AS total FROM achievements;');

         return res.status(200).json({
            success: true,
            data: {
               unlocked: results.map(normaliseRow),
               unlockedCount: parseInt(results.length),
               lockedCount: parseInt(achievements[0].total.toString()),
            },
         });
      } catch (err) {
         return res.status(500).json({
            success: false,
            error: err.message,
         });
      }
   };
};
