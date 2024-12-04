const {POI} = require('../models')
const sequelize = require('../models/sequelize')

const list = (params) => POI.findAll({
  where: {
      categoryId: {
        $in: params.cats
      },
      $or: params.names.map(n=>{return {$or: [{name_en: {$like: '%' + n + '%'}}, {name_uk: {$like: '%' + n + '%'}}, {name_ru: {$like: '%' + n + '%'}}]}})
  },
  attributes: ['id', 'categoryId', 'name_en', 'name_ru', 'name_ukr', 'address', 'housenumber', 'city', 'lon', 'lat']
})

const count = (params) => POI.findAll({
  attributes: [[sequelize.fn('COUNT', sequelize.col('id')), 'poi_count']],
  where: {
    categoryId: {
      $in: params.cats
    },
    $or: params.names.map(n=>{return {$or: [{name_en: {$like: '%' + n + '%'}}, {name_uk: {$like: '%' + n + '%'}}, {name_ru: {$like: '%' + n + '%'}}]}})
  }
});

module.exports = {
  count,
  list
}
