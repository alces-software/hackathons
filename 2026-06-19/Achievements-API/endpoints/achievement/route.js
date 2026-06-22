/**
 * @param {import('mariadb').Connection} conn
 */
module.exports = (conn) =>
   require('express')
      .Router()
      // GET
      .get('/achievement', require('./controller/getAllAchievements')(conn))
      // POST
      .post('/achievement', require('./controller/addAchievement')(conn));
