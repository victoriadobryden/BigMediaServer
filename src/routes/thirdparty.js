const express = require('express')
const thirdparty = require('../services/thirdparty')
const {asyncMW} = require('../utils/async')

const router = express.Router()

router.post('/', asyncMW(async (req, res) => {
  res.json(await thirdparty.list(req.body.dixes))
}))

module.exports = router
