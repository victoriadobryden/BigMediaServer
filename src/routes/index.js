var express = require('express')
var router = express.Router()

// const TrialDateEnd = new Date(2023,7,7)
// const  BBOrgs = [3427,1641,9447,4786,4787,2181,1,2911,5382,1065,12713,10522,11728], 
//        agensyOrgs = [5146,3216,994,29850],
//       agensyDateEnd = new Date(2023,12,31)
//       ,agensy = [ 3,18045,1205,3776,2412 , 5146,3216,994,29850, 29165, 29978]; //Поки усім агенціям --29978 Promodo
//       //29165 Octagom for didenko
function mustBeAuthenticated (req, res, next) {
  if (req.user) return next()
  next(Error(401))
}

// function specialUserForKSData (req, res, next) {
//   let CurDate = new Date();
//   // console.warn(req.user);
//   if (req.user && (BBOrgs.indexOf(req.user.orgId) >= 0 || (agensy.indexOf(req.user.orgId) >= 0 ))) return next()
//     // agensyOrgs.indexOf(req.user.orgId) >= 0 &&  CurDate <= agensyDateEnd ) ||  ( CurDate < TrialDateEnd ))) return next()
//     // req.user.orgId === 1 || req.user.id === 14716 || req.user.id === 14714 || req.user.id === 13177)) return next()
//   next(Error(401))
// }
function specialUserHeatData (req, res, next) {
  let CurDate = new Date();
  //console.warn(['trial',( CurDate < TrialDateEnd ),CurDate,TrialDateEnd]);
  // if (req.user && (BBOrgs.indexOf(req.user.orgId) >= 0 || (agensyOrgs.indexOf(req.user.orgId) >= 0 &&  CurDate <= agensyDateEnd ) ||  ( CurDate < TrialDateEnd ))) return next()
  if (req.user && (req.user.org.showHeatmap)) return next()
  // if (req.user && (BBOrgs.indexOf(req.user.orgId) >= 0 || (agensy.indexOf(req.user.orgId) >= 0 ))) return next()
  // if (req.user && (req.user.orgId === 1 || req.user.id === 14716 || req.user.id === 14714 || req.user.id === 13177 || ( CurDate < TrialDateEnd ) )) return next()
  next(Error(401))
}
module.exports = function(passport) {
  router.use('/subjects', require('./subjects'))
  router.use('/sides', require('./sides'))
  router.use('/faces', require('./faces'))
  router.use('/occupancy', require('./occupancy'))
  router.use('/data', require('./bmdb'))
  router.use('/auth', require('./auth')(passport))
  router.use('/submitCheckout', require('./checkout'))
  router.use('/published', require('./published'))
  router.use('/campaigns', mustBeAuthenticated, require('./campaigns'))
  router.use('/proposals', mustBeAuthenticated, require('./proposals'))
  router.use('/posters', mustBeAuthenticated, require('./posters'))
  router.use('/postertasks', mustBeAuthenticated, require('./postertasks'))
  router.use('/orgs', mustBeAuthenticated, require('./orgs'))
  router.use('/givemepromocode', require('./givemepromocode'))
  // router.use('/advertisers', require('./advertisers'))
  router.use('/thirdparty', mustBeAuthenticated, require('./thirdparty'))
  router.use('/proposalsmix', mustBeAuthenticated, require('./proposalsmix'))
  router.use('/pois', require('./pois'))
  router.use('/userpois', mustBeAuthenticated, require('./userpois'))
  router.use('/icons', mustBeAuthenticated, require('./icons'))
  router.use('/geocoding', mustBeAuthenticated, require('./geocoding'))
  router.use('/facesbypoicats', require('./facesbypoicats'))
  router.use('/geoquery', require('./geoquery'))
  router.use('/noobcreatecampaign', require('./noobcreatecampaign'))
  router.use('/constrinfo', require('./constrinfo'))
  router.use('/taglog', require('./taglog'))
  router.use('/easyboard', require('./easyboard'))
  router.use('/heatmap', specialUserHeatData, require('./heatmap'))
  router.use('/heatinfoots', specialUserHeatData, require('./mediaoption'))
  // router.use('/heatinfoots', specialUserHeatData, require('./heatotsinfo'))
  router.use('/mediaoption', require('./mediaoption'))
  router.use('/monitoring', require('./monitoring'))
  return router
}
