var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');
var Link = require('./link');
var Session = require('./session');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,

  links: function() {
    return this.belongsToMany(Link);
  },
  sessions: function() {
    return this.hasMany(Session);
  },
  initialize: function(){

    // TODO: created event listener for signup and login
    // this.on('creating', function(model, attrs, options){
    //   var shasum = crypto.createHash('sha1');
    //   shasum.update(model.get('url'));
    //   model.set('code', shasum.digest('hex').slice(0, 5));
    // });

  }

});

module.exports = User;
