const conf = require('../config'),
      express = require('express'),
      service = require('../services/monitoring'),
      { asyncMW } = require('../utils/async'),
      Redis = require('ioredis'),
      redis = new Redis({ db: 3, url: conf.get('REDIS') });
const router = express.Router()

router.get('/', asyncMW(async (req, res) => {
  const props = req.body,
        monitorigPeriods = await service.list(),
        result={id:-1,minDate:null,maxDate:null,startDate:null,endDate:null,periods:[]};
  monitorigPeriods.forEach((data)=>{
    // console.warn(data.id);
    result.minDate = (result.minDate==null || result.minDate> data.startDate) ? data.startDate : result.minDate;
    result.maxDate = (result.maxDate==null || result.maxDate< data.endDate) ? data.endDate : result.maxDate;

    result.id = (result.id==-1 || result.endDate < data.endDate) ? +data.id : +result.id;
     if(result.id===data.id){
       result.startDate = data.startDate;
       result.endDate = data.endDate;
    };
    result.periods.push(data);
  });
  res.json(result)
}))
router.post('/', asyncMW(async (req, res) => {
  const props = req.body
  // console.warn(req.sessionID,req.user);
  // allProps = Object.assign(props, {
  //   clientId: req.user.orgId ,
  //   ownerId: req.user.id,
  // })
  res.json(await service.list())
}))
// router.get('/data', asyncMW(async (req, res) => {
//   const props = req.body,
//     allProps = Object.assign(props, {
//       clientId: req.user.orgId,
//       ownerId: req.user.id,
//       // ownerId: req.user.id,
//     });
//   //console.warn(allProps)
//   res.json(await service.dataFull())
// }))
router.get('/brand.json', asyncMW(async (req, res) => {
  const redis = new Redis({ db: 4, url: conf.get('REDIS') });
  let jsonData = [];
  try {
    const keys = await redis.keys('Brand:*');
    if (!keys || keys.length == 0) {
      jsonData = await service.dataBrand();
      jsonData.forEach((brand) => {
        redis.set(`Brand:${brand.id}`, brand.brand);
        redis.expire(`Brand:${brand.id}`, 24 * 60 * 60);
      });
    } else {
      await Promise.all(keys.map(async (key) => {
        let brand = await redis.get(key);
        jsonData.push({ id: parseInt(key.replace('Brand:', '')), brand: brand });
      }));
    }
    res.json(jsonData);
  }
  finally {
    return;
  }
}))
router.get('/adevents.json', asyncMW(async (req, res) => {
  const redis = new Redis({ db: 4, url: conf.get('REDIS') });
  let jsonData = [];
  try {
    const keys = await redis.keys('Adevents:*');
    if (!keys || keys.length == 0) {
      jsonData = await service.dataAdevents();
      jsonData.forEach((adevent) => {
        redis.set(`Adevents:${adevent.id}`, adevent.adevent);
        redis.expire(`Adevents:${adevent.id}`, 24 * 60 * 60);
      });
    } else {
      await Promise.all(keys.map(async (key) => {
        let adevent = await redis.get(key);
        jsonData.push({ id: parseInt(key.replace('Adevents:', '')), adevent: adevent });
      }));
    }
    res.json(jsonData);
  }
  finally {
    return;
  }
}))

router.get('/:id/data', asyncMW(async (req, res) => {
  const MonitoringId = req.params.id,
      keyMonitoring = `MD:${MonitoringId}:*`;
  try {
    const keys = await redis.keys(keyMonitoring);
    let result = []
    if (keys && keys.length != 0) {
      await Promise.all(keys.map(async (keyData) => {
        let md = await redis.hgetall(keyData);
        result.push(md);
      }));
      res.json(result);
    } else {
      let sqlData = await service.dataById(MonitoringId);
      sqlData.forEach((md) => {
        let hashKey = `MD:${MonitoringId}:${md.id}`;
        result.push(md);
        redis.hmset(hashKey, md);
        redis.expire(hashKey, 14 * 24 * 60 * 60);

      });
      res.json(result);
    }
  }catch(error){
    console.warn(error);
  }
  finally {
    return;
  }
}))

router.post('/:id/data', asyncMW(async (req, res) => {
  const MonitoringId = req.params.id,
      keyMonitoring = `MD:${MonitoringId}:*`;
  try {
    const keys = await redis.keys(keyMonitoring);
    let result = []
    if (keys && keys.length != 0) {
      await Promise.all(keys.map(async (keyData) => {
        let md = await redis.hgetall(keyData);
        result.push(md);
      }));
      res.json(result);
    } else {
      let sqlData = await service.dataById(MonitoringId);
      sqlData.forEach((md) => {
        let hashKey = `MD:${MonitoringId}:${md.id}`;
        result.push(md);
        redis.hmset(hashKey, md);
        redis.expire(hashKey, 24 * 60 * 60);

      });
      res.json(result);
    }
  }catch(error){
    console.warn(error);
  }
  finally {
    return;
  }
}))

module.exports = router
