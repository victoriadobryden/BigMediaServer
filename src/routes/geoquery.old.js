const express = require('express')
// const geocoding = require('../services/geocoding')

const {asyncMW} = require('../utils/async')
// const validate = require('../utils/validate')
const Redis = require('ioredis')
const conf = require('../config')
const Occ = require('../lib/faceoccupancy')
const {getFaceFinalMonthPrice} = require('../lib/price')

const router = express.Router()

function clone(obj) {
  var copy;

  // Handle the 3 simple types, and null or undefined
  if (null == obj || "object" != typeof obj) return obj;

  // Handle Date
  if (obj instanceof Date) {
    copy = new Date();
    copy.setTime(obj.getTime());
    return copy;
  }

  // Handle Array
  if (obj instanceof Array) {
    copy = [];
    for (var i = 0, len = obj.length; i < len; i++) {
      copy[i] = clone(obj[i]);
    }
    return copy;
  }

  // Handle Object
  if (obj instanceof Object) {
    copy = {};
    for (var attr in obj) {
      if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
    }
    return copy;
  }

  throw new Error("Unable to copy obj! Its type isn't supported.");
}

router.get('/side/:sideNo', asyncMW(async (req, res) => {
  try {
    const occ = new Occ();
    var occData = occ.getData();
    const sFace = occData.find((f)=>f.sides && JSON.parse(f.sides).find((s)=>+s.num == +req.params.sideNo));
    // const facesById = occ.getFacesById()
    // const sFace = clone(facesById[req.params.id])
    if (sFace) {
      const facesById = occ.getFacesById()
      const ids = [+sFace.id];
      occData.forEach((f) => {
        if (f.lon === sFace.lon && f.lat === sFace.lat && f.id != +req.params.id) {
          ids.push(f.id);
        }
      });
      const features = ids.map((id) => {
        const face = clone(facesById[id])
        if (face) {
          face.status = 'free'
          face.inCart = 0
          face.price = getFaceFinalMonthPrice(face)
          try {
            face.sides = face.sides && (typeof face.sides != 'object') ? JSON.parse(face.sides) : null;
            if (face.sides && face.sides.length > 0) {
              var o = [];
              if (face.id_size != 2 && face.price && ((face.printCost && face.deliveryCost) || face.id_network == 541) ) {
                face.sides.forEach(function(side){
                  o.push(side.occ);
                });
                face.occByDays = occByDays(o);
              } else {
                // face.status = 'free'
                face.occByDays = occByDays(['365s']);
              }
            }
          } catch (e) {
            console.error(face.sides);
            console.warn(e);
          }
          return {
            "type": "Feature",
            "geometry": {
              "type": "Point",
              "coordinates": [face.lon, face.lat]
            },
            "properties": face,
            "id": face.id
          }
        }
      }).filter((item)=>!!item)
      if (features.length) {
        res.json({
          "type": "FeatureCollection",
          "features": features
        })
      } else {
        res.json({error: 'face not found'})
      }
    } else {
      res.json({error: 'side not found'})
    }
  } catch (e) {
    console.error( `side ${req.params.sideNo} not found`);
    console.warn(e);
  }
}))

router.get('/face/:id', asyncMW(async (req, res) => {
  const occ = new Occ();
  const facesById = occ.getFacesById()
  const sFace = clone(facesById[req.params.id])
  //console.warn([req.params.id]);
  if (sFace) {
    try {
      const ids = [+req.params.id];
      var occData = occ.getData();
      occData.forEach((f) => {
        if (f.lon === sFace.lon && f.lat === sFace.lat && f.id != +req.params.id) {
          ids.push(f.id);
        }
      });
      const features = ids.map((id) => {
        const face = clone(facesById[id])
        if (face) {
          face.status = 'free'
          face.inCart = 0
          face.price = getFaceFinalMonthPrice(face)
          try {
            face.sides = face.sides && (typeof face.sides != 'object') ? JSON.parse(face.sides) : null;
            if (face.sides && face.sides.length > 0) {
              var o = [];
              if (face.id_size != 2 && face.price && ((face.printCost && face.deliveryCost) || face.id_network == 541) ) {
                face.sides.forEach(function(side){
                  o.push(side.occ);
                });
                face.occByDays = occByDays(o);
              } else {
                // face.status = 'free'
                face.occByDays = occByDays(['365s']);
              }
            }
          } catch (e) {
            console.error(face.sides);
            console.warn(e);
          }
          return {
            "type": "Feature",
            "geometry": {
              "type": "Point",
              "coordinates": [face.lon, face.lat]
            },
            "properties": face,
            "id": face.id
          }
        }
      }).filter((item)=>!!item)
      if (features.length) {
        res.json({
          "type": "FeatureCollection",
          "features": features
        })
      } else {
        res.json({error: 'face not found'})
      }
    } catch (e) {
      console.error(face.sides);
      console.warn(e);
    }
  } else {
    res.json({error: 'face not found'})
  }
}))

router.get('/', asyncMW(async (req, res) => {
  const {lon, lat, radius} = req.query
  const redis = new Redis(conf.get('REDIS'))
  const occ = new Occ();
  try {
    const faces = await redis.georadius('geofaces', lon, lat, radius, 'm').then((ids) => {
      const facesById = occ.getFacesById()
      res.json({
        "type": "FeatureCollection",
        "features": ids.map((id) => {
          const face = clone(facesById[id])
          if (face) {
            face.status = 'free'
            face.inCart = 0
            face.price = getFaceFinalMonthPrice(face)
            try {
              face.sides = face.sides && (typeof face.sides != 'object') ? JSON.parse(face.sides) : null;
              if (face.sides && face.sides.length > 0) {
                var o = [];
                if (face.id_size != 2 && face.price && ((face.printCost && face.deliveryCost) || face.id_network == 541) ) {
                  face.sides.forEach(function(side){
                    o.push(side.occ);
                  });
                  face.occByDays = occByDays(o);
                } else {
                  // face.status = 'free'
                  face.occByDays = occByDays(['365s']);
                }
              }
            } catch (e) {
              console.error(face.sides);
              console.warn(e);
            } finally {

            }
            return {
              "type": "Feature",
              "geometry": {
                "type": "Point",
                "coordinates": [face.lon, face.lat]
              },
              "properties": face,
              "id": face.id
            }
          }
        },).filter((item)=>!!item)
      })
    })
  } catch (e) {
    console.warn('geoquery georadius error')
    console.warn(e)
  } finally {
    redis.disconnect()
  }
  // res.json(JSON.parse(geoQuery.result))
}))

function occByDays (occArray) {
    var parsedValues = [],
        newValues = occArray;
    if (!newValues) { return;}

    var res,
        re = /(\d+)(\w)/g;
    var maskedArray = newValues.map(function(occString){
        var o = occString,
            daysArray = [];
        while ((res = re.exec(o)) != null) {
            daysArray = daysArray.concat(new Array(+res[1] + 1).join(res[2]).split(''));
        }
        return daysArray;
    }).reduce(function(res, daysArray){
        if (!res) {
            return daysArray;
        }
        return res.map(function(dayStatus, ix){
            if (dayStatus === 'f' || daysArray[ix] === 'f') {
                return 'f';
            }
            if (dayStatus === 't' || daysArray[ix] === 't') {
                return 't';
            }
            if (dayStatus === 'r' || daysArray[ix] === 'r') {
                return 'r';
            }
            if (dayStatus === 's' || daysArray[ix] === 's') {
                return 's';
            }
            if (dayStatus === 'd' || daysArray[ix] === 'd') {
                return 'd';
            }
            return 'n';
        });
    });
    return maskedArray.join('');
}

module.exports = router
