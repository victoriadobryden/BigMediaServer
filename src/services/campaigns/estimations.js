const {decorate} = require('../decorators')
const SQL = require('sql-template-strings')
const sequelize = require('../../models/sequelize')

async function list (campaignId) {
  const sql = SQL`
  SELECT dbo.MaxDate(res.date_beg,est_beg) [startDate], dbo.MinDate(res.date_end,est_end) [endDate],
    dbo.fin_getperiodsum(dbo.MaxDate(res.date_beg,est_beg),dbo.MinDate(res.date_end,est_end),est.id_measure_unit,est.amount_uah) total,
    est.id_measure_unit measureUnit
  FROM fin_estimation est
  LEFT JOIN v_resandsold res on est.id_proposal=res.id_proposal
  WHERE est.id_campaign = ${campaignId}
  AND est.id_estimation_status = 17
  AND est.id_payment_type <> 3
  AND (
    res.id_proposal is null or (
      (est.est_beg is null or est.est_beg<=res.date_end) and
      (est.est_end is null or est.est_end>=res.date_beg)
    )
  )`
  const results = await sequelize.query(sql)
  return results
}

module.exports = {
  list: decorate(list, {permissions: {showCampaignCard: 1}})
}
