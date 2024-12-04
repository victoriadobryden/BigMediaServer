const {Poster, Subject} = require('../../models')
const {decorate} = require('../decorators')

const appCtx = require('continuation-local-storage').getNamespace('app')

async function list (campaignId) {
  return Poster.rls().findAll({
    include: [{model: Subject, attributes: ['id']}],
    where: {campaignId}
  })
}

async function byId (id) {
  return await Poster.rls().findOne({
    include: [{model: Subject, attributes: ['id']}],
    where: {id}
  })
}

async function create (props) {
  const {type, name, documentName, campaignId, subject} = props
  const ownerId = appCtx.get('user').id
  return await Poster.create({type, name, documentName, subject, campaignId, ownerId}, {include: [Subject]})
}

async function replace (id, props) {
  const {type, name, documentName, subject: {subject}} = props
  const posterUpdateCount = await Poster.rls('updateable').updateOne({type, name, documentName}, {where: {id}})
  await Subject.destroy({where: {posterId: id}})
  await Subject.create({posterId: id, subject})
  return Math.max(posterUpdateCount, 1)
}

async function remove (id) {
  return await Poster.rls('updateable').destroyOne({where: {id}})
}

module.exports = {
  list: decorate(list, {permissions: {showPosterCard: 1}}),
  byId: decorate(byId, {permissions: {showPosterCard: 1}}),
  create: decorate(create, {permissions: {showPosterCard: 2}, transactional: {}}),
  replace: decorate(replace, {permissions: {showPosterCard: 2}, transactional: {}}),
  remove: decorate(remove, {permissions: {showPosterCard: 2}, transactional: {}})
}
