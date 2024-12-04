const express = require('express')
const icons = require('../services/icons')

const {asyncMW} = require('../utils/async')
const validate = require('../utils/validate')

const router = express.Router()

function makeIconFromProps (props) {
  const {
    width,
    height,
    iconBlob
  } = props
  const allProps = {
      width,
      height,
      iconBlob
  }

  if (iconBlob) {
    const expectedHeader = 'data:image/png;base64,' //'data:image/jpeg;base64,'
    if (!iconBlob.startsWith(expectedHeader)) throw Error('400: Invalid icon ')
    // allProps.iconBlob = new Buffer(iconBlob.slice(expectedHeader.length), 'base64')
    allProps.iconBlob = Buffer.from(iconBlob.slice(expectedHeader.length), 'base64')
  }
  return allProps
}

router.get('/', asyncMW(async (req, res) => {
  res.json(await icons.list())
}))

router.post('/', asyncMW(async (req, res) => {
  const icon = makeIconFromProps(req.body)
  const newObj = await icons.create(icon)
  // blob is big, remove it from responce
  delete newObj.iconBlob
  res.status(201)
  res.header('Location', `${req.baseUrl}/${newObj.id}`)
  res.json(newObj)
}))

router.get('/:id', asyncMW(async (req, res) => {
  const icon = await icons.byId(validate.id(req.params.id))
  if (!icon) throw Error(404)
  res.json(icon)
}))

router.get('/:id/image', asyncMW(async (req, res) => {
  const {id} = req.params
  const image = await icons.image(id)
  if (!image) throw Error(404)
  res.writeHead(200, {'Content-Type': 'image/jpeg'})
  res.end(image, 'binary')
}))

router.delete('/:id', asyncMW(async (req, res) => {
  const deleted = await icons.remove(validate.id(req.params.id))
  if (deleted === 0) throw Error(404)
  res.json({deleted})
}))

router.put('/:id', asyncMW(async (req, res) => {
  const iconProps = makeIconFromProps(req.body)
  const updated = await icons.replace(validate.id(req.params.id), iconProps)
  if (updated === 0) throw Error(404)
  res.json({updated})
}))

module.exports = router
