const {ServiceOperation, PhotoRec} = require('../../models')

const list = (campaignId, clientId) => ServiceOperation.rls().findAll({
  where: {campaignId},
  include: {
    model: PhotoRec,
    attributes: ['id', 'url']
  }
})

const create = _ => _
const update = _ => _
const remove = _ => _

module.exports = {
  list,
  create,
  update,
  remove
}

