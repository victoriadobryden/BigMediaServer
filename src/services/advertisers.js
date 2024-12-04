const {Advertiser} = require('../models')

const list = () => Advertiser.findAll({
  attributes: ['id', 'name'],
  where: {
      id_parent: 79
  }
})

async function byId (id) {
  return await Advertiser.findOne({ where: {id} })
}

module.exports = {
  list: list,
  byId: byId
}
