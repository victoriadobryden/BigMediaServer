const express = require('express')

const {sequelize} = require('../models')
const SQL = require('sql-template-strings')

const taglogs = require('../services/taglogs')

const {asyncMW} = require('../utils/async')
const router = express.Router()

router.post('/', asyncMW(async (req, res) => {
  const props = req.body
  const site = (props && props.params && props.params.site) ? props.params.site : 'bma';
  const allProps = Object.assign(props, {
    ip: req.ip,
    userId: req.user ? req.user.id : null,
    site: site
  })
  allProps.params = JSON.stringify(allProps.params)
  const newObj = await taglogs.create(allProps)
  res.status(201)
  res.json({})
}))

module.exports = router
