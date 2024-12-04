const express = require('express')
const MediaOptionData = require('../lib/mediaoptiondata')
const CryptoJS = require("crypto-js")
// const {listPolygon, polygonInspection, listCityPeople, listOtsGroup} = require('../services/mediaoption')
const { asyncMW } = require('../utils/async')

const router = express.Router()
router.post('/', asyncMW(async (req, res) => {
  const mediaData = new MediaOptionData(),
  filter = mediaData.convertBodyToFilter(req.body);
  mediaData.getOtsByTransitBy(filter, (result) => {
    res.status(200);
    var scode = req.query._dc ? req.query._dc.toString() + 'j8Z5f644XYePh4g7sEfE' : 'T5YhJJb2CmuM26zcb569';
    var ciphertext = CryptoJS.Rabbit.encrypt(JSON.stringify(result), scode);
    res.json(ciphertext.toString()); 
  })
}))
// router.get('/data', asyncMW(async (req, res) => {
//   const mediaData = new MediaOptionData(),
//   filter = mediaData.convertBodyToFilter(req.body);
//   mediaData.getOtsByTransitBy(filter, (result) => {
//     res.status(200);
//     res.json(result);        
//     // var scode = req.query._dc ? req.query._dc.toString() + 'j8Z5f644XYePh4g7sEfE' : 'T5YhJJb2CmuM26zcb569';
//     // var ciphertext = CryptoJS.Rabbit.encrypt(JSON.stringify(result), scode);
//     // res.json(ciphertext.toString());
//   })
// }))
router.post('/traff', asyncMW(async (req, res) => {
  const mediaData = new MediaOptionData(),
        filter = mediaData.convertBodyToFilter(req.body);
  mediaData.getTrafficBy(filter, (result) => {
    res.status(200);
    var scode = req.query._dc ? req.query._dc.toString() + 'j8Z5f644XYePh4g7sEfE' : 'T5YhJJb2CmuM26zcb569';
    var ciphertext = CryptoJS.Rabbit.encrypt(JSON.stringify(result), scode);
    res.json(ciphertext.toString());
  })
}));
// router.get('/traff/data', asyncMW(async (req, res) => {
//   const mediaData = new MediaOptionData(),
//   filter = mediaData.convertBodyToFilter(req.body);
//   mediaData.getTrafficBy(filter, (result) => {
//     res.status(200);
//     // console.warn(result)
//     res.json(result);        
//     // var scode = req.query._dc ? req.query._dc.toString() + 'j8Z5f644XYePh4g7sEfE' : 'T5YhJJb2CmuM26zcb569';
//     // var ciphertext = CryptoJS.Rabbit.encrypt(JSON.stringify(result), scode);
//     // res.json(ciphertext.toString());
//   })
// }));


router.post('/polygons', asyncMW(async (req, res) => {
  const mediaData = new MediaOptionData(),
        filter = mediaData.convertBodyToFilter(req.body);
  mediaData.getMap(filter, (result) => {
    res.status(200)
    var scode = req.query._dc ? req.query._dc.toString() + 'j8Z5f644XYePh4g7sEfE' : 'T5YhJJb2CmuM26zcb569';
    var ciphertext = CryptoJS.Rabbit.encrypt(JSON.stringify(result), scode);
    res.json(ciphertext.toString()); 
  })
}))
// router.get('/polygons', asyncMW(async (req, res) => {
//   const mediaData = new MediaOptionData(); 
//   mediaData.getMap({}, (result) => {
//     res.status(200)
//     //var scode = req.query._dc ? req.query._dc.toString() + 'j8Z5f644XYePh4g7sEfE' : 'T5YhJJb2CmuM26zcb569';
//     //var ciphertext = CryptoJS.Rabbit.encrypt(JSON.stringify(result), scode);
//     //res.json(ciphertext.toString()); 
//     res.json(result);
//   })
// }))
// router.get('/polygons/data', asyncMW(async (req, res) => {
//    const mediaData = new MediaOptionData();
//    mediaData.getMap({}, (result) => {
//      res.status(200)
//      //var scode = req.query._dc ? req.query._dc.toString() + 'j8Z5f644XYePh4g7sEfE' : 'T5YhJJb2CmuM26zcb569';
//      res.json(result);
//      // var ciphertext = CryptoJS.Rabbit.encrypt(JSON.stringify(result), scode);
//      // res.json(ciphertext.toString()); 
//    })
//  }))

module.exports = router
