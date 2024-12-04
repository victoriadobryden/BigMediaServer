const express = require('express')
const advertisers = require('../services/advertisers')
const {asyncMW} = require('../utils/async')
const validate = require('../utils/validate')

const router = express.Router()

router.get('/', asyncMW(async (req, res) => {
  res.json(await advertisers.list())
}))

router.get('/:id', asyncMW(async (req, res) => {
  const advertiser = await advertisers.byId(validate.id(req.params.id))
  if (!advertiser) throw Error(404)
  res.json(advertiser)
}))

module.exports = router
