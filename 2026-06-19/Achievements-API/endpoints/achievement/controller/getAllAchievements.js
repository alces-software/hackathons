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
         const results = await conn.query('SELECT * FROM achievements');

         return res.status(200).json({
            success: true,
            data: results.map(normaliseRow)
         })
      } catch (err) {
         return res.status(500).json({
            success: false,
            error: err.message,
         });
      }
   };
};
