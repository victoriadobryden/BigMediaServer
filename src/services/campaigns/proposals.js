// const {ProposalMix, ProposalTable} = require('../../models')
const {ProposalMix} = require('../../models')
const {decorate} = require('../decorators')

async function byId (id) {
  return await ProposalMix.rls().findOne({where: {id}, raw: true})
}

async function list (campaignId) {
  const proposals = await ProposalMix.rls().findAll({where: {campaignId}, raw: true})
  if (proposals) {
    proposals.forEach(p => {
      p.photos = JSON.parse(p.photos)
    })
  }
  return proposals
}

async function create (props) {
  let {faceId, startDate, endDate, campaignId, operationId, doorsNo, supplierPrice, supplierPriceEnc} = props
  if (!startDate || !endDate || !campaignId || !operationId) throw Error(400)
  startDate = new Date(startDate)
  endDate = new Date(endDate)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) throw Error(400)
  if (endDate < startDate) throw Error(400)
  const newRecord = await ProposalMix.rls().create({campaignId, startDate, endDate, operationId, faceId, doorsNo, supplierPrice, supplierPriceEnc})
  const newProposalMix = await ProposalMix.findOne({where: {id: newRecord.id}})
  return newProposalMix
}

async function update (id, props) {
  //XXX: change ProposalTable to ProposalMix when sequelize accepts patch
  return await ProposalMix.rls().updateOne(props, {where: {id}})
}

async function remove (id) {
  return await ProposalMix.rls().destroyOne({where: {id}})
}

module.exports = {
  byId: decorate(byId, {permissions: {showProposalCard: 1}}),
  list: decorate(list, {permissions: {showProposalCard: 1}}),
  create: decorate(create, {permissions: {showProposalCard: 2}, transactional: {}}),
  update: decorate(update, {permissions: {showProposalCard: 2}, transactional: {}}),
  remove: decorate(remove, {permissions: {showProposalCard: 2}, transactional: {}})
}
