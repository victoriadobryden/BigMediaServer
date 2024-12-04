const express = require('express')
const service = require('../services/occupancy')
const {asyncMW} = require('../utils/async')

const router = express.Router()
router.get('/', asyncMW(async (req, res) => {
  res.json(await service.list())
}))

module.exports = router
