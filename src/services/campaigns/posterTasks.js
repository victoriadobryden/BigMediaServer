const {PosterTask, Proposal} = require('../../models')
const {decorate} = require('../decorators')

async function createOrReplace ({proposalId, posterId, coverDate}) {
  const proposal = await Proposal.rls().findOne({where:{id: proposalId}})
  if (!proposal) throw Error(404)
  coverDate = new Date(coverDate)                                                                                                      
  if (isNaN(coverDate.getTime())) throw Error('400: Invalid coverDate format')
  console.log(coverDate, proposal.startDate, proposal.endDate, proposal)
  if (coverDate < proposal.startDate || coverDate > proposal.endDate) throw Error('400: Invalid coverDate range')
  // const existingForThisDate = await PosterTask.findOne({proposalId, coverDate})
  // if (existingForThisDate) await existingForThisDate.destroy()
  const posterTask = await PosterTask.create({ proposalId, posterId, coverDate })
  return posterTask
}

module.exports = {
  createOrReplace: decorate(createOrReplace, {permissions: {showProposalCard: 2}, transactional: {}})
}

