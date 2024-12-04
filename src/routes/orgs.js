const express = require('express')
const orgs = require('../services/orgs')
const {asyncMW} = require('../utils/async')
const validate = require('../utils/validate')

const router = express.Router()

function makeOrgFromProps (props) {
  const {
    logoBlob: logo
  } = props
  const allProps = Object.assign({}, props)
  delete allProps.logoBlob

  if (logo) {
    const expectedHeader = 'data:image/png;base64,'
    if (!logo.startsWith(expectedHeader)) throw Error('400: Invalid logo')
    allProps.orgLogo = {
      // logo: new Buffer(logo.slice(expectedHeader.length), 'base64')
      logo: Buffer.from(logo.slice(expectedHeader.length), 'base64')
    }
  }
  return allProps
}

router.get('/', asyncMW(async (req, res) => {
  res.json(await orgs.list())
}))

router.get('/:id', asyncMW(async (req, res) => {
  const org = await orgs.byId(validate.id(req.params.id))
  if (!org) throw Error(404)
  res.json(org)
}))

router.get('/:orgId/logo.png', asyncMW(async (req, res) => {
  const logo = await orgs.logo(validate.id(req.params.orgId))
  if (!logo) throw Error(404)
  res.writeHead(200, {'Content-Type': 'image/png'})
  res.end(logo, 'binary')
}))

router.delete('/:id', asyncMW(async (req, res) => {
  const deleted = await orgs.remove(validate.id(req.params.id))
  if (deleted === 0) throw Error(404)
  res.json({deleted})
}))

router.put('/:id', asyncMW(async (req, res) => {
  const orgProps = makeOrgFromProps(req.body)
  const updated = await orgs.replace(validate.id(req.params.id), orgProps)
  if (updated === 0) throw Error(404)
  res.json({updated})
}))



module.exports = router
