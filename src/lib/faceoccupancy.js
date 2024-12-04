/**
 * Created by Alexander.Ustilov on 23.02.2016.
 */
const conf = require('../config'),
      debug = require('debug')('ol-app:server'),
      log = require('../lib/log')(module),
      sql = require('mssql'),
      config = conf.get('DB'),
      RedisFaces = require('../models/faces'),
      Redis = require('ioredis'),
      redis = new Redis(conf.get('REDIS')),
      prefix = 'facesData:',
      prefixSide = 'sidesData:';

var //faceOccupancy = [],
    lastSyncTime,
    isLoading = false,
    attemptsCount = 0,
    IdTimer;

function syncData() {
    // const facesById = {};
    attemptsCount++;
    if (isLoading) {
        log.debug('Try Sync while Data is loading...');
        return;
    }
    // if(db.getConnectionStatus() !== 'connected'){
    //     log.debug('Initially connect to DB');
    //     db.connectToDB(syncData);
    //     return;
    // }
    isLoading = true;
    log.debug('Data is loading...');
    // var request = new sql.Request();
    sql.on('error', err => {
        console.warn('error', err);
    })
    sql.connect(config).then(pool => {
        return pool.request()
        .execute('sp_web_face_occupancy_v2') 
    }).then(recordsets => {
        isLoading = false;
        if (recordsets.length === 0) {
            log.error('Occupancy error: recordsets is empty ' + 'Status: ' + err.status + '. Error message: ' + err.message);
            log.error(err + '; attempts: ' + attemptsCount.toString() + '; lastSuccessSyncTime: ' + lastSyncTime.toString());
            return;
        }
        if (recordsets.length > 0) {
            var recs = recordsets[0];
            if (recs.length === 0) {
                log.error('Occupancy error: recordset[0] is empty ' + 'Status: ' + err.status + '. Error message: ' + err.message);
                log.error(err + '; attempts: ' + attemptsCount.toString() + '; lastSuccessSyncTime: ' + lastSyncTime.toString());
                return;
            } else {
                log.debug('Exec here ...');
                var dbdata = recs;
                lastSyncTime = new Date();
                attemptsCount = 0;
                log.debug('Data loaded. Records: ' + dbdata.length);
                const geoData = [];
                dbdata.forEach((item) => {
                    let hashKey = `faces:${item.id}:${item.show_data}`;
                    redis.hmset(hashKey, item);
                    redis.expire(hashKey, 60 * 60);
                    
                    let sides = JSON.parse(item.sides);
                    sides.forEach((side)=>{
                        let keySide= `sides:${(!side.num) ? side.sideNo : side.num}`;
                        redis.hmset(keySide, side);
                        redis.hset(keySide,'faceKey', `faces:${item.id}:${item.show_data}`);
                        redis.expire(keySide, 60 * 60);
                    })
                    if (item.lon && item.lat && item.lon!=0 && item.lat!=0) {
                        geoData.push(item.lon)
                        geoData.push(item.lat)
                        // geoData.push(+item.id)
                        geoData.push(`faces:${item.id}:${item.show_data}`)
                    }
                    // facesById[+item.id] = item
                    });
                if (geoData.length > 0) {
                  redis.geoadd('geofaces', ...geoData).then((res) => console.warn('added:  ' + res))
                //   redis.geoadd('geofaces', ...geoData).then((res) => console.warn('added:  ' + res+' --> geoData :'+geoData.length.toString()))
                }
            }
        }
    }).catch(err => {
        if (err) {
            isLoading = false;
            log.error('Occupancy procedure error: ' + 'Status: ' + err.status + '. Error message: ' + err.message);
            log.error(err + '; attempts: ' + attemptsCount.toString() + '; lastSuccessSyncTime: ' + lastSyncTime.toString());
            return;
        }
    })
}
async function getFaceOccupancy(showAllFace){
    let faceOccupancy = [];
    let searchKey= `faces:*:${showAllFace? '*':'1'}`;
    const keys = await redis.keys(searchKey);

    if (keys && keys.length != 0) {
        await Promise.all(keys.map(async (keyFace) => {
            let face = await redis.hgetall(keyFace)
            faceOccupancy.push(face);
            })
        );
    }
    return faceOccupancy;
}

async function getFacesByIdOccupancy(){
    let facesById = {};
    let searchKey= `faces:*:*`;
    const keys = await redis.keys(searchKey);
    if (keys && keys.length != 0) {
        await Promise.all(keys.map(async (keyFace) => {
            let face = await redis.hgetall(keyFace)
            facesById[+face.id] = face
        })
        );
    }
    return facesById;
}
function refreshTimer() {
    debug('refreshTimer executed');
    if (isLoading) {
        clearTimeout(IdTimer);
        attemptsCount++;
    }
    else {
        syncData();
    }
    var rbdConfig = conf.get('refreshBigData'), timeout;
    
    var now = new Date();
    if (now.getDay() == 0 || now.getDay() == 6 || now.getHours() < 8 || now.getHours() > 18) {
        timeout = rbdConfig.otherTimeout;
    }
    else {
        timeout = rbdConfig.workingHoursTimeout;
    }
    var refreshAfter = attemptsCount * timeout;
    if (refreshAfter > 7200000) {
        refreshAfter = 7200000;
        log.error('Error connection to the Database server');
    }
    // console.warn('date',now ,'->>', refreshAfter,timeout);
    refreshAfter = timeout;
    log.debug('New timer started with timeout: ' + refreshAfter);
    IdTimer = setTimeout(refreshTimer, refreshAfter);
}

function Occupancy() {
  this.getData = async function (showAllFace) {
    return await getFaceOccupancy(showAllFace);
  }
  this.getFacesById = async function () {
    return await getFacesByIdOccupancy();
  }
  this.startSync = function () {
    IdTimer = setTimeout(refreshTimer, 0);
    // getFacesByIdOccupancy();
    //RedisFaces.Start();
  }
}

module.exports = Occupancy;
