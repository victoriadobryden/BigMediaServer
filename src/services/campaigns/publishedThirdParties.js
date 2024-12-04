const {PublishedCampaign, PublishedProposal, ViewPublishedThirdParty} = require('../../models')
const {decorate} = require('../decorators')

async function byId (id) {
  return await ViewPublishedThirdParty.rls().findOne({where: {id}, raw: true})
}

async function list (publishedCampaignId) {
  return await ViewPublishedThirdParty.rls().findAll({where: {publishedCampaignId}, raw: true})
}

async function create (props) {
  const {publishedCampaignId, dix, ownerNote, price, startDate, endDate} = props
  const newProposal =  await PublishedProposal.create({publishedCampaignId, proposalId: null, dix, ownerNote, price, startDate, endDate})
  const newThirdParty = await ViewPublishedThirdParty.findOne({where: {id: newProposal.id}})
  return newThirdParty
}

async function update (id, props) {
  const existingProposal = await PublishedProposal.rls().findOne({where: {id}, raw: true})
  const campaign = await PublishedCampaign.rls().findOne({where: {id: existingProposal.publishedCampaignId}, raw: true})
  if (!campaign) throw Error(400)
  const {ownerNote, price} = props
  return await PublishedProposal.rls().updateOne({ownerNote, price}, {where: {id}})
}

async function remove (publishedCampaignId, id) {
  const existingProposal = await PublishedProposal.rls().findOne({where: {id, publishedCampaignId}, raw: true})
  if (!existingProposal) throw Error('404: proposal not found')
  const campaign = await PublishedCampaign.rls().findOne({where: {id: existingProposal.publishedCampaignId}, raw: true})
  if (!campaign) throw Error('404: campaign not found')
  return await PublishedProposal.rls().destroyOne({where: {id: existingProposal.id}})
}

module.exports = {
  byId: decorate(byId, {permissions: {showProposalCard: 1}}),
  list: decorate(list, {permissions: {showProposalCard: 1}}),
  create: decorate(create, {permissions: {showProposalCard: 2}, transactional: {}}),
  update: decorate(update, {permissions: {showProposalCard: 2}, transactional: {}}),
  remove: decorate(remove, {permissions: {showProposalCard: 2}, transactional: {}})
}
