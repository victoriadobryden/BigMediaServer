const express = require('express')
// const {listPolygon} = require('../services/mediaoption')
// const {polygons} = require('../services/mediaoption')
// const {ksPolygon, ksPolygonData} = require('../models')

const {asyncMW} = require('../utils/async')
var MediaOptionsData = require('../lib/mediaoptiondata')
const CryptoJS = require("crypto-js")
const appCtx = require('continuation-local-storage').getNamespace('app')
var pgdb = require('../lib/pgdb')
const getCurrentUserOrgId = _ => appCtx.get('user').orgId
const getCurrentUserId = _ => appCtx.get('user').id

const router = express.Router()

router.post('/', asyncMW(async (req, res) => {
  // console.warn(req.body)
  const mo = new MediaOptionsData(), 
  moGroup = mo.getOtsGroup();
  var group = [],
    groupName,
    daysFilter = [];
  const {daysOfWeek, groups, sex, ages} = req.body;
  if(typeof daysOfWeek === 'undefined' || daysOfWeek.length ===0 ){
  daysFilter = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  } else daysOfWeek.forEach((d)=>{daysFilter.push(d)});
  if (
  (sex.length == 2 && groups.length == 5 && ages.length == 5 )||
  (sex.length == 0 && groups.length == 0 && ages.length == 0 ))
  { group.push(1); } 
  else{
  ages.forEach((age) =>{
  groups.forEach((incomeLevel) =>{
    sex.forEach((s) =>{
        groupName = (age+' | '+incomeLevel + ' | '+ s).toUpperCase();
        group.push(moGroup[groupName]);
    })
  })
  })
  }      
  mo.getOtsByTransitBy({group:group,wekday:daysFilter},(result)=>{
    res.status(200)
    // console.warn(result)
    
    var scode = req.query._dc ? req.query._dc.toString() + 'j8Z5f644XYePh4g7sEfE' : 'T5YhJJb2CmuM26zcb569';
    var ciphertext = CryptoJS.Rabbit.encrypt(JSON.stringify(result), scode);
    res.json(ciphertext.toString()); 
  })
}))
router.post('/traff', asyncMW(async (req, res) => {
  const mo = new MediaOptionsData(), 
  moGroup = mo.getOtsGroup();
  var group = [],
    groupName,
    daysFilter = [];
  const {daysOfWeek, groups, sex, ages} = req.body;
  if(typeof daysOfWeek === 'undefined' || daysOfWeek.length ===0 ){
  daysFilter = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  } else daysOfWeek.forEach((d)=>{daysFilter.push(d)});
  if (
  (sex.length == 2 && groups.length == 5 && ages.length == 5 )||
  (sex.length == 0 && groups.length == 0 && ages.length == 0 ))
  { group.push(1); } 
  else{
  ages.forEach((age) =>{
  groups.forEach((incomeLevel) =>{
    sex.forEach((s) =>{
        groupName = (age+' | '+incomeLevel + ' | '+ s).toUpperCase();
        group.push(moGroup[groupName]);
    })
  })
  })
  }

  mo.getTransit({group:group,wekday:daysFilter},(result)=>{
  res.status(200)
  // console.warn(result)
  var scode = req.query._dc ? req.query._dc.toString() + 'j8Z5f644XYePh4g7sEfE' : 'T5YhJJb2CmuM26zcb569';
  var ciphertext = CryptoJS.Rabbit.encrypt(JSON.stringify(result), scode);
  res.json(ciphertext.toString()); 
  })
}))


router.post('/polygons', asyncMW(async (req, res) => {
  const mo = new MediaOptionsData();
  // console.warn (req, res) ;
  mo.getMap({},(result)=>{
    res.status(200)    
    var scode = req.query._dc ? req.query._dc.toString() + 'j8Z5f644XYePh4g7sEfE' : 'T5YhJJb2CmuM26zcb569';
    // console.warn(JSON.stringify(result));
    var ciphertext = CryptoJS.Rabbit.encrypt(JSON.stringify(result), scode);
    res.json(ciphertext.toString()); 
  })
  
  // const polygons = () => polygons.findAll();
  // console.warn(polygons);
  // let polygons2 = await polygons.list();
  // console.warn(polygons2);
}))

module.exports = router
