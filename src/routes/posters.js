const express = require('express')
const posters = require('../services/campaigns/posters')

const {asyncMW} = require('../utils/async')
const validate = require('../utils/validate')

const router = express.Router()

function makePosterFromProps (props) {
  const {
    type,
    name,
    documentName,
    campaignId,
    subjectBlob: subject
  } = props
  const allProps = {
    type,
    campaignId,
    name,
    documentName
  }

  if (subject) {
    const expectedHeader = 'data:image/jpeg;base64,'
    if (!subject.startsWith(expectedHeader)) throw Error('400: Invalid subject ')
    allProps.subject = {
      // subject: new Buffer(subject.slice(expectedHeader.length), 'base64')
      subject: Buffer.from(subject.slice(expectedHeader.length), 'base64')
    }
  }
  return allProps
}

router.post('/', asyncMW(async (req, res) => {
  const poster = makePosterFromProps(req.body)
  const newObj = await posters.create(poster)
  // blob is big, remove it from responce
  delete newObj.subject.subject
  res.status(201)
  res.header('Location', `${req.baseUrl}/${newObj.id}`)
  res.json(newObj)
}))

router.get('/:id', asyncMW(async (req, res) => {
  const poster = await posters.byId(validate.id(req.params.id))
  if (!poster) throw Error(404)
  res.json(poster)
}))

router.delete('/:id', asyncMW(async (req, res) => {
  const deleted = await posters.remove(validate.id(req.params.id))
  if (deleted === 0) throw Error(404)
  res.json({deleted})
}))

router.put('/:id', asyncMW(async (req, res) => {
  const posterProps = makePosterFromProps(req.body)
  const updated = await posters.replace(validate.id(req.params.id), posterProps)
  if (updated === 0) throw Error(404)
  res.json({updated})
}))

module.exports = router
