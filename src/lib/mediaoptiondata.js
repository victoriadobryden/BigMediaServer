const
    conf = require('../config'),
    config = conf.get('DB'),
    sql = require('mssql'),
    debug = require('debug')('ol-app:server'),
    log = require('./log')(module),
    Redis = require('ioredis'),
    redis = new Redis({ db: 2, url: conf.get('REDIS') });

var Data = {
    getGroupBy: (prop, cb) => { return getOtsGroupBy(prop, cb) },
    getTrafficBy: (prop, cb) => { return getTrafficGroupBy(prop, cb) },
    inspections: {},
    inspectData: {},
    otsGroup: {},
    LoadOTSGroup: false,
    LoadPolygons: false,
    polygonGroup: {
        getPolygonMap: (prop, cb) => { return getDataMapPolygon(prop, cb); },
        getMapPublished: (prop, cb) => { return getMapPublishedBy(prop, cb) },
    },
    isLoading: false,
    attemptsCount: 0,
    InspectionsStartLoading: false,
    LastInspect: 2,
    InspectionStep: 0,
    sqlQuery: {
        mssql: {
            1: `SELECT [group_id] [id_group],[group_name] ,[age] ,[income_level] ,[sex], UPPER([age])+' | '+ UPPER([income_level]) + ' | ' +UPPER(case when [sex]='M' then 'male' when [sex]='F' then 'female' else [sex] end) [filter] FROM [BigBoard].[dbo].[ots_groups]`,
            2: 'select [id] ,[polygon_id] ,[id_city] ,[id_inspection] ,[lat] , [lon] ,[lat1],[lon1] ,[lat2] ,[lon2] ,[geogjson] ,[transit] ,[weight] FROM [dbo].[v_ots_data_polygons] where [id_inspection] = $Inspection',
            3: `select [id_inspection],[id_city],[cnt_people] from get_ots_data_ks_people_v2($xmlData)`,
            4: `select [id_inspection],[id_city],[polygon_id],[cnt_transit],[road_full_transit],[cnt_unique_transit],[road_unique_transit],[weight] from bigboard.dbo.get_ots_data_ks_cities_v2($xmlData) `,
            5: `select id_face, id_inspection, id_city, [OTS], [GRP], [TRP] from bigboard.dbo.get_ots_data_ks_faces_v2 ($xmlData)`
        },
        pgsq: {
            1: 'select id,id_group,code,age,sex,income_level,filter,day_of_week,cnt_people,id_city,id_inspection from v_ots_group_people ',
            2: 'select id, id_inspection, id_city, polygon_id, ST_X(ST_Centroid(geog)::geometry) as lon, ST_Y(ST_Centroid(geog)::geometry) as lat, lat1,lon1 ,lat2,lon2, ST_AsGeoJSON(geog) as geogjson from data_polygons',
            4: 'select id,id_face,id_side,ots,polygon_id,id_city from v_faces_ots where polygon_id>0 and ots>0'
        }
    }
},
    IdTimer

function refreshTimer() {
    debug('refreshTimer executed');
    if (Data.isLoading) {
        clearTimeout(IdTimer);
        Data.attemptsCount++;
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
    var refreshAfter = Data.attemptsCount * timeout;
    if (refreshAfter > 7200000) {
        refreshAfter = 7200000;
        log.error('Error connection to the Database server');
    }
    log.debug('New timer started with timeout: ' + refreshAfter);
    IdTimer = setTimeout(refreshTimer, refreshAfter);
}
function syncData() {
    Data.attemptsCount++;
    if (Data.isLoading) {
        log.debug('Try Sync while Data is loading...');
        return;
    }
    Data.isLoading = true;
    if (!Data.inspections[Data.LastInspect]) { Data.inspections[Data.LastInspect] = { dataIsLoad: false } }
    let prop = getWeekFilter({});
    LoadInspection(prop);
}
async function LoadInspection(prop, cb) {
    let filter = prop.Filter,
        idInspect = prop.idInspect;
    if (Data.inspectData[filter])
        Data.InspectionsStartLoading = !(Data.inspectData[filter].loadCitiesPeople && Data.inspectData[filter].loadPolygonsData && Data.inspectData[filter].loadFacesData);

    if (Data.InspectionsStartLoading || idInspect === -1) return;
    Data.InspectionsStartLoading = true;
    if (typeof Data.lastSyncTime !== 'undefined') {
        if (!!Data.otsGroup[idInspect] && new Date(lastSyncTime.getTime() + (24 * 60 * 60 * 1000)) > new Date()) {
            Data.InspectionsStartLoading = false;
            return
        } else {
            Data.InspectionStep = 0;
        }
    }
    Data.InspectionStep += 1;
    let sqlQuery = {
        1: Data.sqlQuery.mssql[1],
        2: Data.sqlQuery.mssql[2].replace('$Inspection', idInspect),
        3: Data.sqlQuery.mssql[3].replace('$xmlData', prop.XmlFilter),
        4: Data.sqlQuery.mssql[4].replace('$xmlData', prop.XmlFilter),
        5: Data.sqlQuery.mssql[5].replace('$xmlData', prop.XmlFilter),
    };
    if (!Data.inspectData[filter])
        Data.inspectData[filter] = {
            loadCitiesPeople: false,
            startLoadCitiesPeople: false,
            loadPolygonsData: false,
            startLoadPolygonsData: false,
            loadFacesData: false,
            startLoadFacesData: false
        }
    if (!Data.LoadOTSGroup) {
        loadDatamMsSqlPool(sqlQuery[1], (result) => LoadOtsGroup(result));
    }
    if (!Data.LoadPolygons)
        loadDatamMsSqlPool(sqlQuery[2], (result) => LoadPolygons(result));
    if (!Data.inspectData[filter].startLoadCitiesPeople) {
        Data.inspectData[filter].startLoadCitiesPeople = true;
        loadDatamMsSqlPool(sqlQuery[3], (result) => {
            LoadCitiesPeople(result, prop);
            Data.inspectData[filter].loadCitiesPeople = true;
            LoadInspection(prop, cb);
        });
    }
    if (!Data.inspectData[filter].startLoadPolygonsData) {
        Data.inspectData[filter].startLoadPolygonsData = true;
        loadDatamMsSqlPool(sqlQuery[4], (result) => {
            LoadDataPolygons(result, prop);
            Data.inspectData[filter].loadPolygonsData = true;
            LoadInspection(prop, cb);
        });
    }
    if (!Data.inspectData[filter].startLoadFacesData) {
        Data.inspectData[filter].startLoadFacesData = true;
        loadDatamMsSqlPool(sqlQuery[5], (result) => {
            LoadFaces(result, prop);
            Data.inspectData[filter].loadFacesData = true;
            LoadInspection(prop, cb);
        });
    }
    if (Data.inspectData[filter].loadCitiesPeople && Data.inspectData[filter].loadPolygonsData && Data.inspectData[filter].loadFacesData) {
        Data.InspectionsStartLoading = false;
        Data.inspectData[filter].startLoadCitiesPeople = false;
        Data.inspectData[filter].loadPolygonsData = false;
        Data.inspectData[filter].startLoadFacesData = false;

        console.warn(`Data KS Inspect[${idInspect}] is load. Filter => ${filter}. <OK>`)
        Data.lastSyncTime = new Date();
        if (typeof cb !== 'undefined')  cb();
    }
}
function loadDatamMsSqlPool(sqlQuerry, cb) {
    sql.on('error', err => {
        // ... error handler
    })
    sql.connect(config).then(pool => {
        // Query
        return pool.request()
            .query(sqlQuerry)
    }).then(result => {
        cb(result)
    }).catch(err => {
        console.warn(err)
        // ... error checks
    });
}
function LoadOtsGroup(data) {
    Object.values(data).forEach((o) => {
        if (!Data.otsGroup[o.filter]) {
            Data.otsGroup[o.filter] = {
                id: parseInt(o.id_group),
                group_name: o.group_name,
                age: o.age,
                income_level: o.income_level,
                sex: o.sex,
            }
        };
    });
    Data.LoadOTSGroup = true;
}
function LoadPolygons(data) {
    let Polygonons = {};
    Object.values(data).forEach((p) => {
        let idCity = parseInt(p.id_city),
            //id = parseInt(p.id),
            idPolygon = parseInt(p.polygon_id),
            id = `${idCity}:${idPolygon}`,
            idInspection = parseInt(p.id_inspection);
        if (!Polygonons[`${idInspection}:${idCity}`]) Polygonons[`${idInspection}:${idCity}`] = [];
        Polygonons[`${idInspection}:${idCity}`].push(idPolygon);
        let hashKey = `polygon:${idInspection}:${id}`;
        redis.hmset(hashKey, {
            id: id,
            lat: parseFloat(p.lat),
            lon: parseFloat(p.lon),
            type: JSON.parse(p.geogjson).type,
            geog: JSON.stringify(JSON.parse(p.geogjson).coordinates),
        });
        redis.expire(hashKey, 30 * 24 * 60 * 60);
    });
    for (const [key, value] of Object.entries(Polygonons)) {
        redis.hset(`cities:${key}`, `polygons`, JSON.stringify(value));
        redis.expire(`cities:${key}`, 30 * 24 * 60 * 60);
    }
    Data.LoadPolygons = true;
}
function LoadCitiesPeople(data, prop) {
    let Filter = prop.Filter,
        idInspect = prop.idInspect,
        keyCities = `cities:${idInspect}`;
    Object.values(data).forEach((item) => {
        let idCity = parseInt(item.id_city),
            cntPeople = parseInt(item.cnt_people),
            hashKey = `${keyCities}:${idCity}`;
        redis.hset(hashKey, `${Filter}`, cntPeople);
    });
}
function LoadDataPolygons(data, prop, cb) {
    // let param =  prop ?? {};
    let Filter = prop.Filter,
        idInspect = prop.idInspect,
        cityIsLoad = {},
        polygons = [];
    Object.values(data).forEach((item) => {
        let idCity = parseInt(item.id_city),
            idPolygon = parseInt(item.polygon_id),
            id = `${idCity}:${idPolygon}`,
            data = {
                idCity: parseInt(idCity),
                idPolygon: parseInt(idPolygon),
                transit: parseFloat(item.cnt_transit),
                road_full_transit: parseFloat(item.road_full_transit),
                cnt_unique_transit: parseFloat(item.cnt_unique_transit),
                road_unique_transit: parseFloat(item.road_unique_transit),
                weight: parseFloat(item.weight),
            },
            hashKey = `polygon:${idInspect}:${id}`;
        polygons.push(data);
        if (!cityIsLoad[idCity]) cityIsLoad[idCity] = [];
        cityIsLoad[idCity].push(idPolygon);
        redis.hset(hashKey, `${Filter}`, JSON.stringify(data));
        redis.expire(hashKey, 30 * 24 * 60 * 60);
    });
    hashKey = 'LoadPolygonFilters'
    redis.get(`${hashKey}`, function (err, result) {
        let data = [];
        if (err || !result) {
            data.push(`${Filter}`);
            //   redis.set(`${hashKey}`,JSON.stringify([Filter]));
        } else {
            data = JSON.parse(result);
            if (!data.includes(`${Filter}`))
                data.push(`${Filter}`);
        }
        redis.set(`${hashKey}`, JSON.stringify(data));
        redis.expire(`${hashKey}`, ((30 * 24 * 60 * 60) - 60));
    });
    if (typeof cb !== 'undefined') cb(polygons);
}
function LoadFaces(data, prop, cb) {
    let Filter = prop.Filter,
        idInspect = prop.idInspect,
        faces = [];
    Object.values(data).forEach((item) => {
        let hashKey = `face:${idInspect}:${item.id_city}:${item.id_face}`,
            data = {
                idFace: parseInt(item.id_face),
                idCity: parseInt(item.id_city),
                ots: parseFloat(item.OTS),
                grp: parseFloat(item.GRP),
                trp: parseFloat(item.TRP)
            };
        redis.hset(hashKey, `${Filter}`, JSON.stringify(data));
        redis.expire(hashKey, 30 * 24 * 60 * 60);
        faces.push(data);
    });
    hashKey = 'LoadFacesFilters'
    redis.get(`${hashKey}`, function (err, result) {
        let data = [];
        if (err || !result) {
            data.push(`${Filter}`);
        } else {
            data = JSON.parse(result);
            if (!data.includes(`${Filter}`))
                data.push(`${Filter}`);
        }
        redis.set(hashKey, JSON.stringify(data));
        redis.expire(hashKey, ((30 * 24 * 60 * 60) - 60));
    });
    // console.warn(`Loaded Faces ->${Filter}`);
    if (typeof cb !== 'undefined') cb(faces);
}


function getWeekFilter(prop) {
    const idInspect = prop.idInspect || Data.LastInspect,
        group = (typeof prop.group === 'undefined') ? [1]
            : (typeof prop.group !== 'object') ? [prop.group] : prop.group
        , wekday = ((typeof prop.wekday === 'undefined') || (typeof prop.wekday === 'string' && prop.wekday.toLocaleLowerCase() !== 'all'))
            ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            : prop.wekday;

    let WeekFilter = 'set @day=',
        Filter = `${idInspect}/`,
        GroupFilter = '',
        FirstGroup = false,
        XmlFilter = `'<inspection>${idInspect}</inspection>`;
    XmlFilter += '<group>';
    Object.values(group).forEach((g) => {
        Filter += `${g}`;
        GroupFilter += `insert @group values(${g}); `;
        if (g === 1) FirstGroup = true;
        XmlFilter += `<id>${g}</id>`;
    })
    XmlFilter += '</group>';
    Filter += '/'
    WeekFilter += `'`
    Object.values(wekday).forEach((d) => {
        Filter += `${d.substr(0, 2)}`;
        WeekFilter += `~${d}~`;
        XmlFilter += `<day>${d}</day>`;
    })
    XmlFilter += `'`;
    WeekFilter += `'`;
    return { Filter: Filter, WeekFilter: WeekFilter, GroupFilter: GroupFilter, group: group, wekday: wekday, idInspect: idInspect, FirstGroup: FirstGroup, XmlFilter: XmlFilter }
}
async function getDataMapPolygon(prop, cb) {
    let filters = getWeekFilter(prop),
        idInspect = filters.idInspect || Data.LastInspect,
        searchKeyJson = `cities:${idInspect}:*`
    polygons = [];

    if (!Data.inspectData[filters.Filter]) LoadInspection(filters);

    // let testRecords = await redis.get(`cities:${idInspect}:${filters.Filter}`);
    // console.warn(testRecords)
    // if (!testRecords){
    //     console.warn(testRecords)
    // }
    const keys = await redis.keys(searchKeyJson);
    if (keys && keys.length != 0) {
        await Promise.all(keys.map(async (keyJson) => {
            let polygonsCity = JSON.parse(await redis.hget(keyJson, `polygons`));
            await Promise.all(polygonsCity.map(async (keyPolygons) => {
                let polygonsGeo = keyJson.replace('cities', 'polygon') + ':' + keyPolygons,
                    data = await redis.hgetall(polygonsGeo),
                    mo =
                        (data[`${filters.Filter}`] !== undefined)
                            ? JSON.parse(data[`${filters.Filter}`])
                            : { transit: 0, road_full_transit: 0, cnt_unique_transit: 0, road_unique_transit: 0, weight: 0 }
                    ;

                polygons.push(
                    {
                        id: data.id,
                        lat: parseFloat(data.lat),
                        lon: parseFloat(data.lon),
                        type: data.type,
                        geog: JSON.parse(data.geog),
                        transit: mo.transit,
                        road_full_transit: mo.road_full_transit,
                        cnt_unique_transit: mo.cnt_unique_transit,
                        road_unique_transit: mo.road_unique_transit,
                        weight: mo.weight
                    });

            }))
        }));
    }
    cb(polygons);
}
function objectToArray(data, cb) {
    let aresult = [];
    for (var idx in data) { aresult.push(data[idx]) }
    cb(aresult);
}
function getMapPublishedBy(prop, cb) {
    let mapPolygons = Data.polygonGroup.getPolygonMap(prop),
        result = [];
    getTrafficGroupBy(prop, (otsMapPolygons) => {
        for (var idx in mapPolygons) {
            let data = mapPolygons[idx];
            for (var ido in otsMapPolygons) {
                if (otsMapPolygons[ido].id === data.id) {
                    data.weight = otsMapPolygons[ido].weight;
                    data.transit = otsMapPolygons[ido].transit;
                    data.percent = otsMapPolygons[ido].percent;
                }
            }
            result.push(data)
        };
        cb(result);
    })
}
function converWeekFilter(prop) {
    var group = [], groupName, daysFilter = [], idInspect;
    const { daysOfWeek, groups, sex, ages, inspect } = prop;
    if (typeof daysOfWeek === 'undefined' || daysOfWeek.length === 0) {
        daysFilter = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    } else
        daysOfWeek.forEach((d) => { daysFilter.push(d) });
    if ((typeof sex === 'undefined' && typeof groups === 'undefined' && typeof ages === 'undefined')
        || (sex.length == 2 && groups.length == 5 && ages.length == 5)
        || (sex.length == 0 && groups.length == 0 && ages.length == 0)) { group.push(1); }
    else {
        ages.forEach((age) => {
            groups.forEach((incomeLevel) => {
                sex.forEach((s) => {
                    groupName = (age + ' | ' + incomeLevel + ' | ' + s).toUpperCase();
                    // console.warn(groupName);
                    group.push(Data.otsGroup[groupName].id);
                })
            })
        })
    }
    idInspect = (typeof inspect === 'undefined') ? Data.LastInspect : parseInt(inspect);
    return { group: group, wekday: daysFilter, idInspect }
}
async function getOtsGroupByRedis(prop, cb) {
    let filters = getWeekFilter(prop),
        Filter = filters.Filter,
        idInspect = filters.idInspect || Data.LastInspect,
        faces = [],
        searchKeyJson = `face:${idInspect}:*:*`;
    const keys = await redis.keys(searchKeyJson);
    if (keys && keys.length != 0) {
        await Promise.all(keys.map(async (keyJson) => {
            let face = JSON.parse(await redis.hget(keyJson, `${Filter}`));
            // console.warn(face);
            if (face)
                faces.push(face);
            // console.warn(face);
        }))
    }
    cb(faces);
}
async function getOtsGroupBy(prop, cb) {
    let filters = getWeekFilter(prop),
        Filter = filters.Filter,
        hashKey = 'LoadFacesFilters',
        lf = await redis.get(`${hashKey}`),
        LoadedFilters = [];
    if (lf && JSON.parse(lf).length !== 0)
        LoadedFilters = JSON.parse(lf);
    if (LoadedFilters.length === 0 || !LoadedFilters.includes(`${Filter}`)) {
        LoadInspection(filters,()=>{ 
            console.warn('resurn -> getOtsGroupByRedis');
            getOtsGroupByRedis(filters, cb);
        });
    } else {
        // let searchKeyJson = `face:${idInspect}:*:*`;
        getOtsGroupByRedis(filters, cb)
    }
}
async function getTrafficFromRedis(prop, cb) {
    let filters = getWeekFilter(prop),
        Filter = filters.Filter,
        idInspect = filters.idInspect || Data.LastInspect,
        searchKeyJson = `cities:${idInspect}:*`,
        trafficHeatMap = [];
    const keys = await redis.keys(searchKeyJson);
    if (keys && keys.length != 0) {
        await Promise.all(keys.map(async (keyJson) => {
            let polygonsCity = JSON.parse(await redis.hget(keyJson, `polygons`));
            await Promise.all(polygonsCity.map(async (keyPolygons) => {
                let polygonsGeo = keyJson.replace('cities', 'polygon') + ':' + keyPolygons,
                    data = await redis.hgetall(polygonsGeo),
                    mo = (data[`${filters.Filter}`] !== undefined)
                        ? JSON.parse(data[`${Filter}`])
                        : { transit: 0, road_full_transit: 0, cnt_unique_transit: 0, road_unique_transit: 0, weight: 0 };
                trafficHeatMap.push(
                    {
                        id: data.id,
                        transit: mo.transit,
                        road_full_transit: mo.road_full_transit,
                        cnt_unique_transit: mo.cnt_unique_transit,
                        road_unique_transit: mo.road_unique_transit,
                        weight: mo.weight
                    });
            }))
        }));
    }
    cb(trafficHeatMap);
}

async function getTrafficGroupBy(prop, cb) {
    let filters = getWeekFilter(prop),
        Filter = filters.Filter,
        idInspect = filters.idInspect || Data.LastInspect,
        hashKey = 'LoadPolygonFilters',
        lf = await redis.get(`${hashKey}`),
        LoadedFilters = [];
    console.warn(lf);
    if (lf && JSON.parse(lf).length !== 0)
        LoadedFilters = JSON.parse(lf);
    if (LoadedFilters.length === 0 || !LoadedFilters.includes(`${Filter}`)) {
        LoadInspection(filters, ()=>{
            getTrafficFromRedis(filters, cb)
        });
    } else {
        getTrafficFromRedis(filters, cb)
    }
}


function MediaOptionsData() {
    this.getData = () => {
        return Data;
    }
    this.startSync = () => {
        IdTimer = setTimeout(refreshTimer, 0);
    }
    this.getOtsGroup = () => {
        return Data.otsGroup;
    }
    this.convertBodyToFilter = (prop) => {
        return converWeekFilter(prop);
    }
    this.getOtsByTransitBy = async (prop, cb) => {
        Data.getGroupBy(prop, cb)
    }
    this.getTrafficBy = (prop, cb) => {
        // console.warn('!---->',prop)
        Data.getTrafficBy(prop, cb)
    }
    // this.getMap = (prop,cb)=>{
    //     //let data = await Data.polygonGroup.getPolygonMap(prop,cb)
    //     //objectToArray(data);
    //     return await getFaceOccupancy(showAllFace);
    // }
    this.getMap = async (prop, cb) => {
        Data.polygonGroup.getPolygonMap(prop, cb);
        // return objectToArray(await Data.polygonGroup.getPolygonMap(prop),cb);
    }
    this.getPublishedMap = (prop, cb) => {
        Data.polygonGroup.getMapPublished(prop, cb);
    }
}
module.exports = MediaOptionsData;

