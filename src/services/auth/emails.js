const {Email, UserEmail} = require('../../models')
const {decorate} = require('./../decorators')
const appCtx = require('continuation-local-storage').getNamespace('app')

async function list () {
  return await Email.scope('own').findAll()
}

async function byId (id) {
  return await Email.scope('own').findOne({ where: {id} })
}

async function create ({email}) {
  const emailObj = {
    email,
    userEmail: {
      userId: appCtx.get('user').id
    }
  }
  const newObj = await Email.create(emailObj, {include: [UserEmail]})
  return newObj
}

async function replace (id, props) {
  return await Email.scope('own').updateOne(props, {where: {id}})
}

async function remove (id) {
  return await Email.scope('own').destroyOne({where: {id}})
}

module.exports = {
  list,
  byId,
  create: decorate(create, {transactional: {}}),
  replace: decorate(replace, {transactional: {}}),
  remove: decorate(remove, {transactional: {}})
}
