const {UserPOI} = require('../models')
const sequelize = require('../models/sequelize')

const list = (params) => UserPOI.findAll({
  attributes: ['id', 'userId', 'campaignId', 'categoryId', 'customCategory', 'name', 'address', 'housenumber', 'city', 'cityId', 'lon', 'lat', 'color', 'iconPath', 'iconId']
})

module.exports = {
  list
}
