var express = require('express');
var session = require('express-session');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var crypto = require('crypto');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var User = require('./app/models/user');
var SessionKey = require('./app/models/session');
var SessionKeys = require("./app/collections/sessions");

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
app.use(session({
    secret: 'TODOsomestringhere',
    resave: true,
    saveUninitialized: true
}));
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


// TODO function to restrict access based on sessions
function restrict (req, res, next) {
  // console.log('=====================>>> session info:', req.url);
  // console.log(req.session);
  if (req.session.key) {

    SessionKeys.reset()
      .query('where', 'key', '=', req.session.key)
      .fetch()
      .then(function(userKey) {
        if (userKey.length === 0) {
          res.redirect("/login");
        } else {
          next();
        }
      });
  } else {
    //req.session.error = "Access denied.  Please log in.";
    res.redirect('/login');
  }
}

app.get('/', restrict,
function(req, res) {
  res.render('index');
});

app.get('/create', restrict,
function(req, res) {
  res.render('index');
});

app.get('/links', restrict,
function(req, res) {
  SessionKeys.reset()
    .query('where', 'key', '=', req.session.key)
    .fetch()
    .then(function(userKey) {
      var userId = userKey.models[0].attributes.user_id;
      console.log("**********************: userId>>>", userId);

      Users.reset()
        .query('where', 'id', '=', userId)
        .fetch({
          withRelated: ['links']
        })
        .then(function(collection) {
          // console.log(collection.at(0).relations.links.models);
          res.send(200, collection.at(0).relations.links.models);
        });

      // Links.reset()
      //   .fetch()
      //   .then(function(collection) {
      //     res.send(200, collection.models);
      //   });

    });
});

app.post('/links',
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        //look up user_id first
        SessionKeys.reset()
          .query('where', 'key', '=', req.session.key)
          .fetch()
          .then(function(userKey) {
            var userId = userKey.models[0].attributes.user_id;

            var link = new Link({
              url: uri,
              title: title,
              base_url: req.headers.origin,
              // user_id: userId
            });

            link.save().then(function(newLink) {
              newLink.users().attach([userId]);

              res.send(200, newLink);
            });
          });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.get('/signup',
function(req, res) {
  res.render('signup');
});

app.get('/login',
function(req, res) {
  res.render('login');
});

app.get('/logout', function(req, res){
  req.session.destroy(function(){
      res.redirect('/login');
  });
});

app.post('/signup',
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  //Check if username is taken
  Users.reset()
  .query('where', 'username', '=', username)
  .fetch()
  .then(function(collection) {
    // console.log("==========>>", collection);
    if (collection.length !== 0) {
      console.log("username is taken");
      res.redirect("/signup");
      return;
    } else {

      //salt & hash
      var shasum = crypto.createHash('sha1');
      var salt = util.randString(5);
      shasum.update(password);
      shasum.update(salt);
      var passwordHash = shasum.digest('hex');

      //insert username and password hash & salt
      var user = new User({
        username: username,
        password: passwordHash,
        salt: salt
      });


      user.save().then(function(newUser) {
        //console.log('====================>>> New user added:', newUser);

        req.session.regenerate(function(err) {
          // generate a new session here
          var keyStr = util.randString(10);
          req.session.key = keyStr;
          var sessionKey = new SessionKey({
            key: keyStr,
            user_id: newUser.id
          });

          //saves session key in sessions table in database
          sessionKey.save().then(function(newSession) {
            // console.log('======================>>> newsession:', newSession);
            // console.log(req.session);
            res.redirect('/');
          });
        });
      });
    }
  });
});

app.post('/login',
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  Users.reset()
  .query('where', 'username', '=', username)
  .fetch()
  .then(function(collection) {

    if (collection.length === 0) {
      console.log("username does not exist");
      res.redirect("/signup");
      return;
    } else {
      var userCredentials = collection.at(0).attributes;
      console.log('======================>>> userCredentials:', userCredentials);

      //salt & hash
      var shasum = crypto.createHash('sha1');
      var salt = userCredentials.salt;
      shasum.update(password);
      shasum.update(salt);
      var passwordHash = shasum.digest('hex');
      console.log('======================>>> passwordHash:', passwordHash);

      //verifying if password is correct
      if (passwordHash === userCredentials.password) {
        req.session.regenerate(function(err) {
          // generate a new session here
          var keyStr = util.randString(10);
          req.session.key = keyStr;
          var sessionKey = new SessionKey({
            key: keyStr,
            user_id: userCredentials.id
          });

          //saves session key in sessions table in database
          sessionKey.save().then(function(newSession) {
            // console.log('======================>>> newsession:', newSession);
            // console.log(req.session);
            res.redirect('/');
          });
        });
      } else {
        console.log("passwordHash did not match");
        res.redirect("/signup");
      }
    }
  });

});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
