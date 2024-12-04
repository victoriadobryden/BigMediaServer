const {GeoQuery} = require('../models')

const {decorate} = require('./decorators')

const fetch = require('node-fetch')

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
async function processQuery (address, name, language) {
  // fromDate = fromDate || new Date()
  // if (isNaN(fromDate.getTime())) throw Error(400)
  const cached = await GeoQuery.findOne({
    where: {
      $and: {
        address: address,
        language: language,
        result: {
          $like: '{"results":%'
        }
      }
    },
    raw: true,
    nest: true
  })
  let result
  const keyUsed = 'AIzaSyAGumQJIJMbnrFZZFvCUNRHK7x5QA3qvGs'
  if (!cached) {
    const googleQuery = address.replace(/\s+/g , '+')
    const json = await fetch('https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(googleQuery) + '&language=' + (language || 'uk') + '&key=' + keyUsed).then(res => res.json())
    result = json
  } else {
    result = JSON.parse(cached.result)
  }
  return {
      address: address,
      result: JSON.stringify(result),
      name: name,
      keyUsed: (!!cached ? null : keyUsed),
      fromCache: (!!cached ? 1 : 0),
      language: language
  }
}

async function create ({userId, address, result, name, keyUsed, fromCache, lat, lon, language}) {
  const newGQ = await GeoQuery.create({userId, address, result, name, keyUsed, fromCache, lat, lon, language})
  return {id: newGQ.id}
}

module.exports = {
  processQuery: processQuery,
  create: decorate(create, {transactional: {}}),
}
