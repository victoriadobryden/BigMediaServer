const {PublishedProposal, ViewPublishedPresenter, Side, PhotoPresentation} = require('../../models')
const {decorate} = require('../decorators')

async function byId (id) {
  return await ViewPublishedPresenter.findOne({
    where: {id},
    include: [{
      model: Side,
      include: [{
        model: PhotoPresentation
      }]
    }]
  })
}

async function byCampaignAndProposal ({publishedCampaignId, proposalId}) {
  return await ViewPublishedPresenter.findOne({
    where: {publishedCampaignId, proposalId},
    include: [{
      model: Side,
      include: [{
        model: PhotoPresentation
      }]
    }]
  })
}

async function list (campaignId) {
  return await ViewPublishedPresenter.findAll({where: {campaignId}, raw: true})
}

async function create (props) {
  const {
    publishedCampaignId,
    proposalId,
    customRating,
    decision,
    note
  } = props

  return await PublishedProposal.create({
    publishedCampaignId,
    proposalId,
    customRating,
    decision,
    note
  })
}

async function update (id, props) {
  const [count] = await PublishedProposal.update(props, {where: id})
  return count
}

async function updateOrCreate (props) {
  const {
    publishedCampaignId,
    proposalId: index,
    customRating,
    decision,
    note
  } = props

  const updatedFields = {
    customRating,
    decision,
    note
  }

  switch (index % 4) {
    case 1: {
      const proposalId = index >> 2
      const [updateCount] = await PublishedProposal.update(updatedFields, {
        where: {
          publishedCampaignId,
          proposalId
        }
      })

      if (updateCount === 0) {
        const { id } = await PublishedProposal.create({
          publishedCampaignId,
          proposalId,
          customRating,
          decision,
          note
        })
        return {id}
      } else if (updateCount === 1) {
        return {id: proposalId * 4 + 1}
      } else {
        throw Error('Invalid update count')
      }
    }
    case 0: {
      const id = index >> 2
      const [updateCount] = await PublishedProposal.update(updatedFields, {where: {id}})
      if (updateCount === 0) throw Error('404')
      return {id: id * 4}
    }
  }
}

module.exports = {
  byId,
  byCampaignAndProposal,
  list,
  create: decorate(create, {transactional: {}}),
  update: decorate(update, {transactional: {}}),
  updateOrCreate: decorate(updateOrCreate, {transactional: {}})
}
