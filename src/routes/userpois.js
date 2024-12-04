const express = require('express')
const service = require('../services/userpois')
const {asyncMW} = require('../utils/async')

const router = express.Router()
router.post('/count', asyncMW(async (req, res) => {
  const props = req.body
  if (!props.names || !props.names.length) {
      props.names = ['']
  }
  if (!props.cats || !props.cats.length ) {
      res.json([{poi_count: 0}])
  } else {
      res.json(await service.count(props))
  }
}))

router.get('/', asyncMW(async (req, res) => {
  const result = await service.list()
  res.json(result)
}))

module.exports = router
