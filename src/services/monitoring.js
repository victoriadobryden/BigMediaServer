const {MonitoringData, Monitoring, MonitoringBrand, MonitoringAdevents} = require('../models')

const list = () => Monitoring.findAll()

const dataBrand = () => MonitoringBrand.findAll()
const dataBrandById = () => MonitoringBrand.findAll({where :{BrandId}})
const dataAdevents = () => MonitoringAdevents.findAll()
const dataAdeventsById = () => MonitoringAdevents.findAll({where :{adeventId}})
const dataFull = () => MonitoringData.findAll()
const dataById = (MonitoringId) => 
  MonitoringData.findAll({where :{MonitoringId},raw: true})
/**
 * 
 *  return await Campaign.rls('details').findOne({
    where: {
      id,
      $or: [ {deleted: null}, {deleted: false} ]
    },
    raw: true,
    nest: true
  })
 */
module.exports = {
  list,dataById, dataFull, dataBrand, dataBrandById, dataAdevents, dataAdeventsById
}
