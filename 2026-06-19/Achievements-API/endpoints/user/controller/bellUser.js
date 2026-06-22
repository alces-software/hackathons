const { exec } = require('node:child_process');
const { writeFile } = require('node:fs');

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
         const { id, username: inputUsername } = req.query || {};

         let username = inputUsername;

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

         if (!username) {
            const results = await conn.query('SELECT username FROM users WHERE id = ? LIMIT 1', [
               id,
            ]);

            if (results.length === 0) {
               return res.status(404).json({
                  success: false,
                  error: 'no user was found with that id',
               });
            }

            username = results[0].username;
         }

         exec(`who | awk -v user="${username}" '$1==user {print "/dev/"$2}'`, (err, stdout) => {
            const sessions = err ? [] : stdout.trim().split('\n').filter(Boolean);

            if (sessions.length > 0) {
               for (const tty of sessions) {
                  writeFile(tty, '\u0007', () => {});
               }
            }
         });

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
