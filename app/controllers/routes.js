var fs = require('fs')
  , _ = require('lodash')
  , expressJwt = require('express-jwt')
  , status = require('../lib/status.js')
  , config = require('config')
  ;

module.exports = function(app) {

  /**
   * Public methods.
   */
  var Controllers = app.set('controllers')
    , mw = Controllers.middlewares
    , users = Controllers.users
    , auth = Controllers.auth
    , params = Controllers.params
    , groups = Controllers.groups
    , activities = Controllers.activities
    , errors = app.errors
    ;


  /**
   * Status.
   */
  app.get('/status', status);


  /**
   * Parameters.
   */
  app.param('userid', params.userid);
  app.param('groupid', params.groupid);


  /**
   * Authentication.
   */
  app.use(mw.apiKey, expressJwt({secret: config.keys.opencollective.secret, userProperty: 'remoteUser', credentialsRequired: false}), mw.identifyFromToken);


  /**
   * Fake temp response.
   */
  var fake = function(req, res, next) {
    return next(new errors.NotImplemented('Not implemented yet.'));
  };


  /**
   * Users.
   */
  app.post('/users', mw.required('api_key'), mw.authorizeApp, mw.internal, mw.required('user'), users.create); // Create a user.
  app.get('/users/:userid', mw.authorize, users.show); // Get a user.
  app.put('/users/:userid', fake); // Update a user.
  app.get('/users/:userid/email', fake); // Confirm a user's email.


  /**
   * Authentication.
   */
  app.post('/authenticate', mw.required('api_key'), mw.authorizeApp, mw.required('password'), mw.authenticate, auth.byPassword, users.getToken); // Authenticate user to get a token.
  app.post('/authenticate/refresh', fake); // Refresh the token (using a valid token OR a expired token + refresh_token).
  app.post('/authenticate/reset', fake); // Reset the refresh_token.


  /**
   * Credit card.
   *
   *  Let's assume for now a card is linked to a user.
   */
  app.post('/users/:userid/cards', fake); // Create a user's card.
  app.put('/users/:userid/cards/:cardid', fake); // Update a user's card.
  app.delete('/users/:userid/cards/:cardid', fake); // Delete a user's card.


  /**
   * Groups.
   */
  app.post('/groups', mw.authorize, mw.required('group'), groups.create); // Create a group. Option `role` to assign the caller directly (default to null).
  app.get('/groups/:groupid', mw.authorizeUserOrApp, mw.authorizeGroup, groups.get);
  app.put('/groups/:groupid', fake); // Update a group.
  app.delete('/groups/:groupid', fake); // Delete a group.


  /**
   * UserGroup.
   *
   *  Routes to deal with the relations between a group and a user.
   */
  app.get('/users/:userid/groups', mw.authorize, mw.authorizeUser, users.getGroups); // Get user's groups.
  app.post('/groups/:groupid/users/:userid', mw.authorize, mw.authorizeGroup, mw.authorizeGroupAdmin, groups.addMember) // Add a user to a group.
  app.put('/groups/:groupid/users/:userid', fake); // Update a user's role in a group.
  app.delete('/groups/:groupid/users/:userid', fake); // Remove a user from a group.


  /**
   * Transactions (financial).
   */
  app.get('/groups/:groupid/transactions', fake); // Get a group's transactions.
  app.post('/groups/:groupid/transactions', fake); // Create a transaction for a group.


  /**
   * Activities.
   *
   *  An activity is linked to a User (and potentially to a group).
   */
  app.get('/groups/:groupid/activities', mw.authorize, mw.authorizeGroup, mw.paginate(), mw.sorting({key: 'createdAt', dir: 'DESC'}), activities.group); // Get a group's activities.
  app.get('/users/:userid/activities', mw.authorize, mw.authorizeUser, mw.paginate(), mw.sorting({key: 'createdAt', dir: 'DESC'}), activities.user); // Get a user's activities.


  /**
   * Error handler.
   */
  app.use(function(err, req, res, next) {
    if (err.name === 'UnauthorizedError') // because of jwt-express
      err.code = err.status;
    res.header('Cache-Control', 'no-cache');

    // Validation error.
    var e = err.name.toLowerCase();
    if (e.indexOf('validation') !== -1)
      err = new errors.ValidationFailed(null, _.map(err.errors, function(e) { return e.path; }), err.message);
    else if (e.indexOf('uniqueconstraint') !== -1)
      err = new errors.ValidationFailed(null, _.map(err.errors, function(e) { return e.path; }), 'Unique Constraint Error.');

    if (!err.code)
      err.code = err.status || 500;

    // console.trace(err);
    console.error('Error Express : ', err);
    res.status(err.code).send({error: err});
  });

};
