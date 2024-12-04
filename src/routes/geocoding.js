const express = require('express')
const geocoding = require('../services/geocoding')

const {asyncMW} = require('../utils/async')
const validate = require('../utils/validate')

const router = express.Router()

router.get('/', asyncMW(async (req, res) => {
  const geoQuery = await geocoding.processQuery(req.query.address, req.query.name, req.query.language)
  geoQuery.userId = req.user.id
  await geocoding.create(geoQuery)
  res.json(JSON.parse(geoQuery.result))
}))

module.exports = router
