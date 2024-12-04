const express = require('express')
// const geocoding = require('../services/geocoding')

const { asyncMW } = require('../utils/async')
// const validate = require('../utils/validate')
const conf = require('../config'),
  Redis = require('ioredis'),
  redis = new Redis(conf.get('REDIS'));
const { getFaceFinalMonthPrice } = require('../lib/price')

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
    const keySide = `sides:${+req.params.sideNo}`,
      features = [],
      rSide = await redis.hgetall(keySide);
    if (rSide) {
      const face = await redis.hgetall(`${rSide.faceKey}`);
      if (face) {
        face.status = 'free'
        face.inCart = 0
        face.price = getFaceFinalMonthPrice(face);
        try {
          face.sides = face.sides && (typeof face.sides != 'object') ? JSON.parse(face.sides) : null;
          if (face.sides && face.sides.length > 0) {
            var o = [];
            if (face.id_size != 2 && face.price && ((face.printCost && face.deliveryCost) || face.id_network == 541)) {
              face.sides.forEach(function (side) {
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
        features.push({
          "type": "Feature",
          "geometry": {
            "type": "Point",
            "coordinates": [face.lon, face.lat]
          },
          "properties": face,
          "id": face.id
        });
        if (features.length) {
          res.json({
            "type": "FeatureCollection",
            "features": features
          })
        } else {
          res.json({ error: 'Side not found' })
        }
      }
    } else {
      res.json({ error: 'Side not found' })
    }
  } catch (e) {
    console.error(`Side ${req.params.sideNo} not found`);
    console.warn(e);
  }
}))

router.get('/face/:id', asyncMW(async (req, res) => {
  try {
    //console.warn(req.params.id);
    const keys = await redis.keys(`faces:${+req.params.id}:*`),
      features = [];
    
    if (keys) {
      await Promise.all(keys.map(async (key) => {
        let face = await redis.hgetall(key);
        if (face) {
          face.status = 'free'
          face.inCart = 0
          face.price = getFaceFinalMonthPrice(face)
          try {
            face.sides = face.sides && (typeof face.sides != 'object') ? JSON.parse(face.sides) : null;
            if (face.sides && face.sides.length > 0) {
              var o = [];
              if (face.id_size != 2 && face.price && ((face.printCost && face.deliveryCost) || face.id_network == 541)) {
                face.sides.forEach(function (side) {
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
          features.push({
            "type": "Feature",
            "geometry": {
              "type": "Point",
              "coordinates": [face.lon, face.lat]
            },
            "properties": face,
            "id": face.id
          });
        } else {
          res.json({ error: 'face not found' })
        }
      }));
      if (features.length) {
        res.json({
          "type": "FeatureCollection",
          "features": features
        })
      } else {
        res.json({ error: 'face not found' })
      }
    } else {
      res.json({ error: 'face not found' })
    }
  } catch (e) {
    console.error(`face ${req.params.id} not found`);
    console.warn(e);
  }
}))

router.get('/', asyncMW(async (req, res) => {
  const { lon, lat, radius } = req.query,
        redis = new Redis(conf.get('REDIS')),
        features = [];
  // const occ = new Occ();
  try {
    const ids = await redis.georadius('geofaces', lon, lat, radius, 'm');
    await Promise.all(ids.map(async (faceId) => {
      let face = await await redis.hgetall(faceId);
      if(face){
        face.status = 'free';
        face.inCart = 0;
        face.price = getFaceFinalMonthPrice(face);
        face.sides = face.sides && (typeof face.sides != 'object') ? JSON.parse(face.sides) : null;
        if (face.sides && face.sides.length > 0) {
          var o = [];
          if (face.id_size != 2 && face.price && ((face.printCost && face.deliveryCost) || face.id_network == 541)) {
            face.sides.forEach(function (side) {
              o.push(side.occ);
            });
            face.occByDays = occByDays(o);
          } else {
            face.occByDays = occByDays(['365s']);
          }
        }

      }
      features.push({
        "type": "Feature",
        "geometry": {
          "type": "Point",
          "coordinates": [face.lon, face.lat]
        },
        "properties": face,
        "id": face.id
      });
    }));
    if (features.length) {
      res.json({
        "type": "FeatureCollection",
        "features": features
      })
    } else {
      res.json({ error: 'geoquery georadius error' })
    }
  } catch (e) {
    console.warn('geoquery georadius error')
    console.warn(e)
  } finally {
    redis.disconnect()
  }
  // res.json(JSON.parse(geoQuery.result))
}))

function occByDays(occArray) {
  var parsedValues = [],
    newValues = occArray;
  if (!newValues) { return; }

  var res,
    re = /(\d+)(\w)/g;
  var maskedArray = newValues.map(function (occString) {
    var o = occString,
      daysArray = [];
    while ((res = re.exec(o)) != null) {
      daysArray = daysArray.concat(new Array(+res[1] + 1).join(res[2]).split(''));
    }
    return daysArray;
  }).reduce(function (res, daysArray) {
    if (!res) {
      return daysArray;
    }
    return res.map(function (dayStatus, ix) {
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
