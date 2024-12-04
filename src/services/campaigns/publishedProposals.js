const {PublishedCampaign, PublishedProposal, ViewPublishedProposal, ViewPublishedThirdParty} = require('../../models')
const {decorate} = require('../decorators')

async function byId (id) {
  return await ViewPublishedProposal.rls().findOne({where: {id}, raw: true})
}

async function list (publishedCampaignId) {
  return await ViewPublishedProposal.rls().findAll({where: {publishedCampaignId}, raw: true})
}

async function create (props) {
  const {publishedCampaignId, proposalId, dix, ownerNote, price, startDate, endDate} = props
  if (dix && proposalId) throw Error('400: Both dix and proposalId is specified')
  if (!dix && !proposalId) throw Error('400: Neither dix nor proposalId is specified')
  return await PublishedProposal.create({publishedCampaignId, proposalId, dix, ownerNote, price, startDate, endDate})
}

async function update (id, props) {
  const existingProposal = await PublishedProposal.rls().findOne({where: {id}, raw: true})
  const campaign = await PublishedCampaign.rls().findOne({where: {id: existingProposal.publishedCampaignId}, raw: true})
  if (!campaign) throw Error(400)
  const {ownerNote, price} = props
  return await PublishedProposal.rls().updateOne({ownerNote, price}, {where: {id}})
}

async function remove (publishedCampaignId, proposalId) {
  const existingProposal = await PublishedProposal.rls().findOne({where: {proposalId, publishedCampaignId}, raw: true})
  if (!existingProposal) throw Error(404)
  const campaign = await PublishedCampaign.rls().findOne({where: {id: existingProposal.publishedCampaignId}, raw: true})
  if (!campaign) throw Error(404)
  return await PublishedProposal.rls().destroyOne({where: {id: existingProposal.id}})
}

async function updateOrCreate (props) {
  const {
    publishedCampaignId,
    proposalId,
    ownerNote,
    price
  } = props
  if (!publishedCampaignId) throw Error(400)
  const campaign = PublishedCampaign.rls().findOne({where: {id: publishedCampaignId}, raw: true})
  if (!campaign) throw Error(404)
  const updatedFields = { ownerNote, price }
  const [updateCount] = await PublishedProposal.update(updatedFields, {
    where: {
      publishedCampaignId,
      proposalId
    }
  })

  if (updateCount === 0) {
    await create(props)
  }

  return {id: proposalId}
}

module.exports = {
  byId: decorate(byId, {permissions: {showProposalCard: 1}}),
  list: decorate(list, {permissions: {showProposalCard: 1}}),
  create: decorate(create, {permissions: {showProposalCard: 2}, transactional: {}}),
  update: decorate(update, {permissions: {showProposalCard: 2}, transactional: {}}),
  remove: decorate(remove, {permissions: {showProposalCard: 2}, transactional: {}}),
  updateOrCreate: decorate(updateOrCreate, {permissions: {showProposalCard: 2}, transactional: {}})
}
