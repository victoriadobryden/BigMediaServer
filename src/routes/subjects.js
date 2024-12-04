const express = require('express')
const service = require('../services/subjects')
const {asyncMW} = require('../utils/async')

const router = express.Router({strict: true})

router.get('/:subjectId/image.jpeg', asyncMW(async (req, res) => {
  const {subjectId} = req.params
  const image = await service.image(subjectId)
  if (!image) throw Error(404)
  res.writeHead(200, {'Content-Type': 'image/jpeg'})
  res.end(image, 'binary')
}))

router.get('/:subjectId', asyncMW(async (req, res) => {
  const {subjectId} = req.params
  if (!Number.isFinite(Number(subjectId))) throw Error(404)
  const result = await service.load(subjectId)
  res.json(result || null)
}))

module.exports = router
