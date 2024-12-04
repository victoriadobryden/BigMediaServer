const express = require('express')
const service = require('../services/campaigns/posterTasks')
const {asyncMW} = require('../utils/async')

const router = express.Router({strict: true})

router.post('/', asyncMW(async (req, res) => {
  const newObj = await service.createOrReplace(req.body)
  res.status(201)
  res.json(newObj)
}))

module.exports = router
