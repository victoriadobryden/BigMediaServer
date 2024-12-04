const express = require('express')
const publishedCampaigns = require('../services/published/campaigns')
const proposals = require('../services/published/proposals')
const proposalsmix = require('../services/published/proposalsmix')
const messages = require('../services/published/messages')
const {asyncMW} = require('../utils/async')
const MediaOptionData = require('../lib/mediaoptiondata')

const {sequelize} = require('../models')
const SQL = require('sql-template-strings')

const validate = require('../utils/validate')

const multer  = require('multer')
const upload = multer()

const CryptoJS = require("crypto-js")

const router = express.Router()

router.get('/campaigns/:id', asyncMW(async (req, res) => {
  const campaign = await publishedCampaigns.byId(req.params.id)
  if (!campaign) throw Error(404)
  res.json(campaign)
}))

router.put('/campaigns/:id', asyncMW(async (req, res) => {
  const props = req.body
  const updated = await publishedCampaigns.update(req.params.id, props)
  if (updated === 0) throw Error(404)
  res.json({updated})
}))

router.get('/campaigns/:id/publishedproposals', asyncMW(async (req, res) => {
  res.json(await proposals.list(req.params.id))
}))

router.get('/campaigns/:publishedCampaignId/publishedproposals/:proposalId', asyncMW(async (req, res) => {
  res.json(await proposals.byCampaignAndProposal(req.params.proposalId))
}))

router.post('/campaigns/:publishedCampaignId/publishedproposals', asyncMW(async (req, res) => {
  const props = req.body
  const allProps = Object.assign(props, req.params)
  const result = await proposals.updateOrCreate(allProps)
  res.status(200)
  res.header('Location', `${req.baseUrl}/campaigns/${req.params.publishedCampaignId}/publishedproposals/${result.publishedProposalId}`)
  res.json(result)
}))

router.put('/campaigns/:publishedCampaignId/publishedproposals/:proposalId', asyncMW(async (req, res) => {
  console.log('PUT')
  const props = req.body
  const allProps = Object.assign(props, req.params)
  const result = await proposals.updateOrCreate(allProps)
  res.status(200)
  res.header('Location', `${req.baseUrl}/campaigns/${req.params.publishedCampaignId}/publishedproposals/${result.publishedProposalId}`)
  res.json(result)
}))

router.post('/campaigns/:publishedCampaignId/messages', asyncMW(async (req, res) => {
  const props = req.body
  const {publishedCampaignId} = req.params
  const allProps = Object.assign(props, {publishedCampaignId})
  const newObj = await messages.create(allProps)
  res.status(201)
  // res.header('Location', `${req.baseUrl}/${campaignId}/proposals/${newObj.id}`)
  res.json(newObj)
}))

router.post('/campaigns/:publishedCampaignId/bulkAddPubPrices', upload.none(), asyncMW(async (req, res) => {
  const props = req.body
  const {publishedCampaignId} = req.params
  const proposals = props.proposals

  const [result] = await sequelize.query(
    SQL`
    exec sp_web_bulk_add_pubprices
    @id_pub_campaign  = ${publishedCampaignId},
    @pub_prices    = ${proposals}
  `)
  if (!result) throw Error('bulk add prices failed')
  res.status(201)

  res.json(result)
}))

router.get('/campaigns/:id/proposalsmix', asyncMW(async (req, res) => {
  res.json(await proposalsmix.list(req.params.id))
}))

router.put('/campaigns/:publishedCampaignId/proposalsmix/:id', asyncMW(async (req, res) => {
  console.log('PUT')
  const props = req.body
  const updated = await proposalsmix.update(req.params.id, props)
  if (updated === 0) throw Error(404)
  res.json({updated})
}))

router.get('/campaigns/:id/heatmap', asyncMW(async (req, res) => {
  try {
  const scode = req.query._dc ? req.query._dc.toString() + 'yQeKcGT1ydcKvHXbedkQ' : 'cXXu1rpYmuKbV6q2akvP'
  const pubCampId = req.params.id
  const result = await sequelize.query( SQL`exec sp_web_published_heatmap @id  = ${pubCampId} `)
  if (!result) throw Error('get published campaign heatmap failed')

  if (!result || !result.length) {
    res.status(404)
  }
  let filter = {
    group:{},
    wekday:{}
  }
  result.forEach((item) => {     
    filter.group =  item.group.split(',')
    filter.wekday = item.daysOfWeek.split(',')
  });
  const mediaData = new MediaOptionData();
  mediaData.getPublishedMap(filter,(resultMo)=>{
    res.status(200)
    // var scode = req.query._dc ? req.query._dc.toString() + 'j8Z5f644XYePh4g7sEfE' : 'T5YhJJb2CmuM26zcb569';
    var ciphertext = CryptoJS.Rabbit.encrypt(JSON.stringify(resultMo), scode);
    res.json(ciphertext.toString()); 
  })
  /** 
  // console.warn (req, res) ;
  mo.getMap({},(result)=>{
    res.status(200)    
    var scode = req.query._dc ? req.query._dc.toString() + 'j8Z5f644XYePh4g7sEfE' : 'T5YhJJb2CmuM26zcb569';
    // console.warn(JSON.stringify(result));
    var ciphertext = CryptoJS.Rabbit.encrypt(JSON.stringify(result), scode);
    res.json(ciphertext.toString()); 
  })
   */
  // var ciphertext = CryptoJS.Rabbit.encrypt(JSON.stringify(result), scode);
  // res.json(ciphertext.toString());
  
  // var zip = new JSZip();
  // zip.file('data.txt', ciphertext.toString());
  // zip.generateAsync({compression: "DEFLATE", type: "base64", compressionLevel: 1}).then(function (bs) {
  //     // res.json({data: bs});
  //     // console.warn('three');
  //     res.json(JSON.stringify(bs));
  // });
  } catch (e) {
    console.warn('campaign heatmap error')
    console.warn(e)
  }
}))

module.exports = router
