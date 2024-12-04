const express = require('express')
const proposalsmix = require('../services/campaigns/proposalsmix')

const {asyncMW} = require('../utils/async')
const validate = require('../utils/validate')

const router = express.Router()

router.post('/', asyncMW(async (req, res) => {
  const props = req.body
  const allProps = Object.assign(props, {
    clientId: req.user.orgId,
    ownerId: req.user.id
  })
  const newObj = await proposalsmix.create(allProps)
  if (!newObj || !newObj.id) {
    res.status(205)
    res.json({})
  } else {
    res.status(201)
    res.header('Location', `${req.baseUrl}/${newObj.id}`)
    res.json(newObj)
  }
}))

router.get('/:id', asyncMW(async (req, res) => {
  const proposalmix = await proposalsmix.byId(validate.id(req.params.id))
  if (!proposalmix) throw Error(404)
  res.json(proposalmix)
}))

router.delete('/:id', asyncMW(async (req, res) => {
  const deleted = await proposalsmix.remove(validate.id(req.params.id))
  if (deleted === 0) throw Error(404)
  res.json({deleted})
}))

router.put('/:id', asyncMW(async (req, res) => {
  const props = req.body
  const updated = await proposalsmix.update(validate.id(req.params.id), props)
  if (updated === 0) throw Error(404)
  res.json({updated})
}))

module.exports = router
