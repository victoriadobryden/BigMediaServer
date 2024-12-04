const {
  Campaign,
  User,
  sequelize
} = require('../models')

const {decorate} = require('./decorators')

// const appCtx = require('continuation-local-storage').getNamespace('app')
// waitSigned
/*
    [sequelize.literal(`(
         CASE WHEN EXISTS(SELECT * FROM fin_document d
         INNER JOIN v_link_document_campaign ldc ON d.id=ldc.id_document
         INNER JOIN fin_reference ds ON d.id_status=ds.id
         WHERE ds.code='DS_WAITED' AND ldc.id_campaign=[Campaign].[id_campaign]) THEN 1
         ELSE 0 END
      )`), 'waitSigned']
*/
Campaign.addScope('details', {
  include: [{ model: User, as: 'manager', attributes: ['id', 'name'], required: true }],
  attributes: [
    [sequelize.fn('dbo.fin_getCampFinBalanceMoney', sequelize.col(Campaign.attributes.id.field)), 'fin.balance'],
    [sequelize.fn('dbo.fin_getCampBudget', sequelize.col('Campaign.id_campaign')), 'fin.budget'],
    [sequelize.literal(`(
        SELECT TOP 1 s.id_subject
        FROM subjects s INNER JOIN posters p ON s.id_poster=p.id_poster
        WHERE p.id_camp=[Campaign].[id_campaign]
        ORDER BY p.date_entry  DESC
      )`), 'subjectId'],
    [sequelize.literal(`(
      select top 1 pac.id from published_adv_camps pac where pac.id_campaign = [Campaign].[id_campaign] and pac.deleted = 0
    )`), 'publishedId'],
    [sequelize.literal(`
      (select top 1 man.[fullname] from [dbo].[persons] man where man.id_person=[Campaign].[id_manager])`), 'managerName'],
    [sequelize.literal(`
      COALESCE((select top 1 own.[fullname] from [dbo].[persons] own where own.id_person=[Campaign].[id_owner]), (select top 1 man.[fullname] from [dbo].[persons] man where man.id_person=[Campaign].[id_manager]))`), 'owner']
  ]
})

async function list ({fromDate} = {}) {
  fromDate = fromDate || new Date()
  if (isNaN(fromDate.getTime())) throw Error(400)
  return await Campaign.rls('details').findAll({
    where: {
      endDate: {$gte: fromDate},
      $or: [ {deleted: null}, {deleted: false} ]
    },
    order: [
      ['create_date', 'DESC']
    ],
    raw: true,
    nest: true
  })
}

async function byId (id) {
  return await Campaign.rls('details').findOne({
    where: {
      id,
      $or: [ {deleted: null}, {deleted: false} ]
    },
    raw: true,
    nest: true
  })
}

async function create ({name, startDate, endDate, managerId, filters, params}) {
  startDate = new Date(startDate)
  endDate = new Date(endDate)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) throw Error(400)
  const newCamp = await Campaign.create({name, startDate, endDate, managerId, filters, params})
  return {id: newCamp.id}
}

async function replace (id, {name, startDate, endDate, managerId, filters, params}) {
  startDate = new Date(startDate)
  endDate = new Date(endDate)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) throw Error(400)
  return await Campaign.rls().updateOne({name, startDate, endDate, managerId, filters, params}, {where: {id}})
}

async function remove (id) {
  return await Campaign.rls().updateOne({deleted: 1}, {where: {id}})
}

module.exports = {
  list: decorate(list, {permissions: {showAdvCampaigns: 1}}),
  byId: decorate(byId, {permissions: {showCampaignCard: 1}}),
  create: decorate(create, {permissions: {showCampaignCard: 2}, transactional: {}}),
  replace: decorate(replace, {permissions: {showCampaignCard: 2}, transactional: {}}),
  remove: decorate(remove, {permissions: {showCampaignCard: 2}, transactional: {}})
}
