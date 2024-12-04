const express = require('express')
// const geocoding = require('../services/geocoding')
const {sequelize} = require('../models')
const {asyncMW} = require('../utils/async')
// const validate = require('../utils/validate')
// const occ = require('../lib/faceoccupancy')
const CryptoJS = require("crypto-js")
// const JSZip = require("jszip")

// const {decorate} = require('../services/decorators')

const router = express.Router()

router.post('/', asyncMW(async (req, res) => {
  try {

  const {daysOfWeek, hours, groups, sex, types, version} = req.body

  let sex_param = '';
  if (sex.length == 1) {
    sex_param = ' * (ksd.cnt_' + sex[0] + ' / ksd.cnt_all_subs)';
  }
  let ver = 1
  if (version && version.length > 0) {
    ver = 2
  }

  const daysCount = daysOfWeek.length || 1;

  let fields = 'ksd.cnt_all_subs';
  if (types && types.length > 0) {
    fields = '(' + types.map(t => 'ksd.' + t).join (' + ') + ')'
  }

  // console.warn(groups)
  // console.warn(daysOfWeek);
  // console.warn(hours);
  // console.warn(fields);
  console.warn(sex_param);
  // console.warn([sex_param, daysCount]);

  const result = await sequelize.query(`
    select
      ksd.polygon_id id,
      (ksp.lon1 + (ksp.lon2-ksp.lon1) / 2) as [lon],
      (ksp.lat1 + (ksp.lat2-ksp.lat1) / 2) as [lat],
      ksp.lon1, ksp.lon2, ksp.lat1, ksp.lat2,
      round(sum(${fields} ${sex_param}) / (0.45 * ${daysCount}), 0) cnt_transit
    from ` +
    (ver == 1 ? 'ks_data ksd' : 'ks_data_routes ksd') +
    `  inner join ks_polygons ksp on ksd.polygon_id=ksp.polygon_id ` +
      (ver == 1 ? 'inner join ks_groups ksg on ksd.group_id=ksg.group_id' : 'inner join ks_groups ksg on ksd.group_name=ksg.group_no') +
    ` where
      ksd.day_of_week in (:daysOfWeek)
      and ksd.hhour_distr in (:hours)
      and ksg.group_name in (:groups)
      and ksd.cnt_all_subs > 0
    group by ksd.polygon_id, ksp.lon1, ksp.lon2, ksp.lat1, ksp.lat2
    `, { replacements: {
        daysOfWeek: daysOfWeek,
        hours: hours,
        groups: groups
      }, type: sequelize.QueryTypes.SELECT })

  if (!result || !result.length) {
    throw Error('something went wrong')
  }
  res.status(200)
  // res.json(result)
  var scode = req.query._dc ? req.query._dc.toString() + 'yQeKcGT1ydcKvHXbedkQ' : 'cXXu1rpYmuKbV6q2akvP';
  // console.warn(scode);
  // console.warn(req.query);
  var ciphertext = CryptoJS.Rabbit.encrypt(JSON.stringify(result), scode);
  res.json(ciphertext.toString());
  // var zip = new JSZip();
  // zip.file('data.txt', ciphertext.toString());
  // zip.generateAsync({compression: "DEFLATE", type: "base64", compressionLevel: 1}).then(function (bs) {
  //     // res.json({data: bs});
  //     // console.warn('three');
  //     res.json(JSON.stringify(bs));
  // });
  } catch (e) {
    console.warn('extract kyivstar data error')
    console.warn(e)
  }
  // res.json(JSON.parse(geoQuery.result))
}))

router.get('/streets', asyncMW(async (req, res) => {
  try {

  const {daysOfWeek, hours, groups} = req.body

  const result = await sequelize.query(`
    select distinct geometry_id [id], direction, geometry from ks_streets_21_02
    `)

  if (!result || !result.length) {
    throw Error('something went wrong')
  }
  res.status(200)
  res.json(result)
  } catch (e) {
    console.warn('extract kyivstar data error')
    console.warn(e)
  }
  // res.json(JSON.parse(geoQuery.result))
}))

// module.exports = decorate(router, {permissions: {showKSData: 1}})
module.exports = router
