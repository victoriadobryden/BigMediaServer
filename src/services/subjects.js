const {Subject} = require('../models')

const load = (id) => Subject.findOne({
  where: { id },
  attributes: { exclude: ['subject'] }
})

const image = async (id) => {
  const object = await Subject.findOne({
    where: { id },
    attributes: { exclude: ['id', 'posterId'] }
  })
  return object && object.subject
}

module.exports = {
  load,
  image
}
