// load all the things we need
const LocalStrategy = require('passport-local').Strategy
const FacebookTokenStrategy = require('passport-facebook-token')
// load the auth constiables
const FACEBOOK = require('../config').get('FACEBOOK')
const auth = require('../services/auth')
const {asyncToCb} = require('../utils/async')

module.exports = function (passport) {
  passport.serializeUser(asyncToCb(auth.serializeUser))
  passport.deserializeUser(asyncToCb(auth.deserializeUser))

  passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
  }, asyncToCb(auth.localLogin)))

  passport.use(new FacebookTokenStrategy({
    clientID: FACEBOOK.clientID,
    clientSecret: FACEBOOK.clientSecret,
    profileFields: ['id', 'name', 'picture', 'email'],
    passReqToCallback: true
  }, asyncToCb(auth.facebookLogin)))
  return passport
}
