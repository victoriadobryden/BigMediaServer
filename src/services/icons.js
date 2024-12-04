const {Icon} = require('../models')
const {decorate} = require('./decorators')

const appCtx = require('continuation-local-storage').getNamespace('app')

async function list () {
  return await Icon.rls().findAll({
      attributes: { exclude: ['iconBlob'] },
      where: {
        deleted: { $ne: 1}
      }
  })
}

async function byId (id) {
  return await Icon.rls().findOne({
    where: {id}
  })
}

async function create (props) {
  const {width, height, iconBlob} = props
  const ownerId = appCtx.get('user').id
  return await Icon.create({width, height, iconBlob, ownerId})
}

async function replace (id, props) {
  const {width, height, iconBlob} = props
  const posterUpdateCount = await Poster.rls('updateable').updateOne({width, height, iconBlob}, {where: {id}})
  return Math.max(posterUpdateCount, 1)
}

async function remove (id) {
  return await Icon.rls('updateable').destroyOne({where: {id}})
}

const image = async (id) => {
  const object = await Icon.rls().findOne({
    where: { id },
    attributes: ['iconBlob']
  })
  return object && object.iconBlob
}

module.exports = {
  list: list,
  byId: byId,
  create: decorate(create, {transactional: {}}),
  replace: decorate(replace, {transactional: {}}),
  remove: decorate(remove, {transactional: {}}),
  image: image
}
