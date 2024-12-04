const express = require('express')
const auth = require('../services/auth')
const emails = require('../services/auth/emails')
const {asyncMW} = require('../utils/async')
const validate = require('../utils/validate')

function sendUserJson (req, res) {
  res.json(req.user || null)
}

function relogin (req) {
  return new Promise((resolve, reject) => req.login(req.user, (err, res) => err ? reject(err) : resolve(res)))
}

// TODO: we can user req._passport instead of passing passport to module
module.exports = passport => {
  const router = express.Router()
  router.post('/facebook-token', passport.authenticate('facebook-token', {scope: 'email', return_scopes: true}), sendUserJson)
  router.delete('/facebook-token', asyncMW(async (req, res) => {
    const user = req.user
    if (!user) throw Error(401)
    const deleted = await auth.facebookRemoveToken(user)
    if (deleted === 0) throw Error(404)
    await relogin(req)
    res.json({deleted})
  }))
  router.get('/facebook', passport.authenticate('facebook', {scope: 'email'}))
  router.get('/facebook/callback', passport.authenticate('facebook'), sendUserJson)
  router.post('/local/login', passport.authenticate('local'), sendUserJson)
  router.get('/user', sendUserJson)
  router.put('/user', asyncMW(async (req, res) => {
    const user = req.user
    if (!user) throw Error(401)
    req.user = await auth.updateProfileInfo(user, req.body)
    await relogin(req)
    sendUserJson(req, res)
  }))
  router.post('/logout', (req, res) => {
    req.logout()
    sendUserJson(req, res)
  })
  router.post('/local/signup', asyncMW(async (req, res) => {
    req.user = await auth.localSignup(req, req.body)
    await relogin(req)
    sendUserJson(req, res)
  }))

  router.put('/password', asyncMW(async (req, res) => {
    req.user = await auth.updatePassword(req.user, req.body)
    sendUserJson(req, res)
  }))

  router.post('/password', asyncMW(async (req, res) => {
    await auth.askForPasswordReset(req.body)
    sendUserJson(req, res)
  }))

  router.get('/password/:id', asyncMW(async (req, res) => {
    const user = await auth.performPasswordReset(req.params.id)
    req.user = user
    await relogin(req)
    sendUserJson(req, res)
  }))

  router.get('/user/emails', asyncMW(async (req, res) => {
    res.json(await emails.list())
  }))

  router.get('/user/emails/:id', asyncMW(async (req, res) => {
    res.json(await emails.byId(validate.id(req.params.id)))
  }))

  router.post('/user/emails', asyncMW(async (req, res) => {
    const newObj = await emails.create(req.body)
    res.status(201)
    res.header('Location', `${req.baseUrl}/user/emails/${newObj.id}`)
    res.json(newObj)
  }))

  router.put('/user/emails/:id', asyncMW(async (req, res) => {
    const props = req.body
    const updated = await emails.replace(validate.id(req.params.id), props)
    res.json({updated})
  }))

  router.delete('/user/emails/:id', asyncMW(async (req, res) => {
    const deleted = await emails.remove(validate.id(req.params.id))
    if (deleted === 0) throw Error(404)
    res.json({deleted})
  }))

  return router
}
