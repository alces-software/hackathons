/**
 * @param {import('mariadb').Connection} conn
 */
module.exports = (conn) =>
   require('express')
      .Router()
      // GET
      .get('/user', require('./controller/getUser')(conn))
      .get('/user/achievements', require('./controller/getUserAchievements')(conn))
      .get('/user/has/achievement', require('./controller/userHasAchievement')(conn))
      .get('/user/exist', require('./controller/userExists')(conn))
      // PUT
      .put('/user/bell', require('./controller/bellUser')(conn))
      // POST
      .post('/user', require('./controller/addUser')(conn))
      .post('/user/achieved', require('./controller/addAchievementToUser')(conn));
