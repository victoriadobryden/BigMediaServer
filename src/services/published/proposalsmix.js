const {ProposalMix, Side, PhotoPresentation} = require('../../models')
const {decorate} = require('../decorators')

async function byId (id) {
  return await ProposalMix.findOne({
    where: {id},
    include: [{
      model: Side,
      include: [{
        model: PhotoPresentation
      }]
    }]
  })
}

async function list (campaignId) {
  return await ProposalMix.findAll({where: {campaignId}, raw: true})
}

async function update (id, props) {
  let {pubDecision, pubNote, pubCustomRating} = props
  return await ProposalMix.updateOne({pubDecision, pubNote, pubCustomRating}, {where: {id}})
}

module.exports = {
  byId,
  list,
  update: decorate(update, {transactional: {}})
}
