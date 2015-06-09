var db = require('../config');
var User = require('./user');
var crypto = require('crypto');

var Session = db.Model.extend({
  tableName: 'sessions',
  hasTimestamps: true,
  user: function() {
    return this.belongsTo(User, 'user_id');
  }
});

module.exports = Session;
