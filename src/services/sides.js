const {Side, Face} = require('../models')

const list = () => Side.findAll({
  where: {
    demountedAt: {
      $or: {
        $eq: null,
        $gt: new Date()
      }
    }
  },
  attributes: ['id', 'num', 'doorsNo', 'faceId']
})

module.exports = {
  list
}
