const {PublishedCampaign} = require('../../models')
const {decorate} = require('../decorators')

async function byId (id) {
  return await PublishedCampaign.rls().findOne({
    where: {
      id,
      $or: [ {deleted: null}, {deleted: false} ]
    },
    raw: true
  })
}

async function list (campaignId) {
  return await PublishedCampaign.rls().findAll({
    where: {
      campaignId,
      $or: [ {deleted: null}, {deleted: false} ]
    },
    raw: true
  })
}

async function create (props) {
  let {startDate, endDate, campaignId, email, note, name, closed, cryptoHash, showBigmediaCodes, showSupplierCodes, showDoorsCodes, showSuppliers, showMetrics, showCptMetrics, showCoverage, showPrices, showHeatmap, heatmapParams, heatmapParamsXml} = props
  if (!startDate || !endDate || !campaignId || !name) throw Error(400)
  startDate = new Date(startDate)
  endDate = new Date(endDate)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) throw Error(400)
  if (endDate < startDate) throw Error(400)
  return await PublishedCampaign.create({startDate, endDate, campaignId, email, note, name, closed, cryptoHash, showBigmediaCodes, showSupplierCodes, showDoorsCodes, showSuppliers, showMetrics, showCptMetrics, showCoverage, showPrices, showHeatmap, heatmapParams, heatmapParamsXml})
}

async function replace (id, props) {
  let {startDate, endDate, email, note, name, closed, cryptoHash, showBigmediaCodes, showSupplierCodes, showDoorsCodes, showSuppliers, showMetrics, showCptMetrics, showCoverage, showPrices, showHeatmap, heatmapParams, heatmapParamsXml} = props
  if (!startDate || !endDate || !name) throw Error(400)
  startDate = new Date(startDate)
  endDate = new Date(endDate)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) throw Error(400)
  if (endDate < startDate) throw Error(400)

  return await PublishedCampaign.rls().updateOne({startDate, endDate, email, note, name, closed, cryptoHash, showBigmediaCodes, showSupplierCodes, showDoorsCodes, showSuppliers, showMetrics, showCptMetrics, showCoverage, showPrices, showHeatmap, heatmapParams, heatmapParamsXml}, {where: {id}})
}

async function remove (id) {
  return await PublishedCampaign.rls().updateOne({deleted: true}, {where: {id}})
}

module.exports = {
  byId: decorate(byId, {permissions: {showProposalCard: 1}}),
  list: decorate(list, {permissions: {showProposalCard: 1}}),
  create: decorate(create, {permissions: {showProposalCard: 2}, transactional: {}}),
  replace: decorate(replace, {permissions: {showProposalCard: 2}, transactional: {}}),
  remove: decorate(remove, {permissions: {showProposalCard: 2}, transactional: {}})
}
