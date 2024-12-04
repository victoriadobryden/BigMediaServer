const express = require('express')
const {sequelize} = require('../models')
const {asyncMW} = require('../utils/async')

const router = express.Router()

router.post('/', asyncMW(async (req, res) => {
  const props = req.body
  const poicats = props.poicats
  const cities = props.cities
  if (!poicats || !poicats.length || !cities || !cities.length) {
    res.status(404)
    return
  }
  const poicatsxml = '<poicat id="' + poicats.join('"></poicat><poicat id="') + '"></poicat>'
  const citiesxml = '<city id="' + cities.join('"></city><city id="') + '"></city>'
  const result = await sequelize.query(`
      exec sp_web_facesbypoicats
      @poicats    = :poicats,
      @cities    = :cities,
      @distance   = null,
      @before = null
    `, { replacements: {
        poicats: poicatsxml,
        cities: citiesxml
      }, type: sequelize.QueryTypes.SELECT })

  if (!result) throw Error('select faces by poicats failed')
  res.status(200)
  res.json(result)
}))

module.exports = router
