var express = require('express')
var router = express.Router()

var debug = require('debug')('ol-app:server')
var log = require('../lib/log')(module)
var db = require('../lib/db')
var Occ = require('../lib/faceoccupancy')
var encoding = require('encoding');
const CryptoJS = require("crypto-js")
const JSZip = require("jszip")
const { asyncMW } = require('../utils/async')

const appCtx = require('continuation-local-storage').getNamespace('app')
const { getFaceFinalMonthPriceWoVAT } = require('../lib/price')

router.get('/', asyncMW(async (req, res, next) => {

    //debug('Connection here ...');

    var qry;

    if (req.query.city) {
        debug('Get cities');
        qry = 'select id_city id, id_type, name_ru, name name_ukr, name_en, population from cities where (disabled is null or disabled = 0)';
    }
    else if (req.query.brandshelterscount) {
        debug('Get brandshelters');
        qry = 'select count(distinct id_constr) as [shelters_count] from v_web_brandshelters';
    }
    else if (req.query.promocode) {
        debug('Get promocode');
        var pc = req.query.promocode;
        pc = pc.replace(/![\-\d\w]/gi, '')
        pc = pc.replace(/'/g, "''")
        qry = 'select code, discount, id_org from web_discount where active = 1 and code = \'' + pc + '\'';
    }
    else if (req.query.size) {
        debug('Get sizes');
        qry = 'select id_sizetype id, name name_ru, name_ukr, name_en from sizetypes';
    }
    else if (req.query.catab) {
        debug('Get catABs');
        qry = 'select id_cathegory id, name name_ru, name name_ukr, name name_en from cathegories';
    }
    else if (req.query.network) {
        debug('Get networks');
        qry = 'select frm.id, frm.str_value name_ru, frm.str_value name_ukr, frm.str_value name_en from fin_reference frm inner join fin_reference par on frm.id_parent=par.id where par.code=\'SIDE_NETWORK\'';
    }
    else if (req.query.sidetype) {
        debug('Get sidetypes');
        qry = 'select sdt.id_sidetype id, sdt.name name_ru, sdt.name name_ukr, sdt.name name_en from sidetypes sdt';
    } else if (req.query.street) {
        debug('Get streets: ' + req.query.sname);
        var s = req.query.sname
        s = s.replace(/'/g, "''")
        qry = "exec [dbo].[sp_web_street_search] @street = N'" + s + "'";
    } else if (req.query.search) {
        debug('Search: ' + req.query.q);
        if (!req.query.q) {
            if (req.query.callback) {
                res.jsonp([]);
            }
            else {
                res.json([]);
            }
            return;
        }
        var q = req.query.q.toString(),
            l = req.query.locale.toString()
        q = q.replace(/'/g, "''")
        l = l.replace(/'/g, "''")
        qry = "exec [dbo].[sp_web_search] @search = N'" + q + "', @locale = N'" + l + "'";
    } else if (req.query.poi) {
        debug('Get POI: ' + req.query.pname);
        var s = req.query.pname
        s = s.replace(/'/g, "''")
        qry = "exec [dbo].[sp_web_poi_search_v2] @poi = N'" + s + "'";
    } else if (req.query.faceinfo) {
        // console.warn(req.query.id);
        debug('Get faceinfo Num: ' + req.query.id);
        var s = req.query.id
        s = s.replace(/\D/g, '')
        qry = 'exec [dbo].[sp_web_face_info] @id_face = ' + s;
    } else if (req.query.poicategory) {
        debug('Get POI Categories references');
        qry = 'select id, id_parent, name_en name_en, name_ru, name_uk name_ukr, map_icon from map_poi_category';
    } else if (req.query.poicat) {
        debug('Get POI Categories');
        qry = 'exec [dbo].[sp_web_poi_category_v2]';
    }
    else {
        debug('Get faces');
        var locale = 'ukr';
        if (req.query.locale) {
            locale = req.query.locale;
        }
        const user = appCtx.get('user')
        const showAllconstr = user != null && user.org && user.org.showPlanner >= 1;
        const occ = new Occ();
        var occData = await occ.getData(showAllconstr);
        const typeClient = user != null && user.org && user.org.showPlanner == 2;
        var dbdata = occData
            .filter(item => (user && user.org && user.org.showPlanner >= 1) || (parseFloat(item.show_data) === 1))
            .map(function (item) {
            let oSides = []
            try {
                oSides = JSON.parse(item.sides)
            } catch (e) {
                console.error('Error during parse sides field: %o', item.sides);
            }
            return {
                address: item["address_" + locale] || item["address_ukr"],
                id: parseInt(item.id),
                num: item.num,
                id_city: parseInt(item.id_city),
                id_size: parseInt(item.id_size),
                id_network: parseInt(item.id_network),
                // occupancy:   null, //item.occupancy,
                lon: parseFloat(item.lon),
                lat: parseFloat(item.lat),
                grp: parseFloat(item.grp),
                ots: parseFloat(item.ots),
                doors_no: typeClient ? '' : item.doors_no,
                pos: item.pos,
                angle: parseInt(item.angle),
                id_catab: parseInt(item.id_catab),
                rating: item.rating,
                busy: parseInt(item.busy),
                light: item.light,
                streets: item.streets,
                price: parseFloat(typeClient ? getFaceFinalMonthPriceWoVAT(item) : item.price),
                supplier_sidetype: item.supplier_sidetype,
                sides: oSides,
                photo_url: item.photo_url,
                schema_url: item.schema_url,
                id_supplier: typeClient ? 1 : parseInt(item.id_supplier),
                supplier_sn: typeClient ? item.num : item.supplier_sn,
                hide_doors_data: typeClient ? 1 : item.hide_doors_data,
                city_region: item.city_region_ukr,
                // IdFotoMonitor     : item.IdFotoMonitor,
                // PhotoMonitorOnly  : item.foto_monitor_only
            };
        });

        // for testing reduce rows count for fast loading
        // console.dir(process.env.NODE_ENV === 'production');

        // if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'testing') {
        //     console.warn('!data was sliced to 100 records for development mode!');
        //     dbdata = dbdata.slice(0, 100);
        // }

        // if (req.query.arch) {
        if (user && user.org && user.org.showPlanner) {
            if (req.query.callback) {
                res.jsonp(dbdata);
            }
            else {
                res.json(dbdata);
            }
        } else {
            var scode = req.query._dc ? req.query._dc.toString() : 'fuckyoubastards';
            // console.warn('one');
            var ciphertext = CryptoJS.Rabbit.encrypt(JSON.stringify(dbdata), scode);
            // console.warn('two');
            res.json(ciphertext.toString());
            // var zip = new JSZip();
            // zip.file('data.txt', ciphertext.toString());
            // zip.generateAsync({compression: "DEFLATE", type: "base64", compressionLevel: 1}).then(function (bs) {
            //     // res.json({data: bs});
            //     console.warn('three');
            //     res.json(JSON.stringify(bs));
            // });
        }
        return;
    }
    db.execSql(qry, function (dbdata, err) {
        if (err) {
            log.error(err);
        }
        else {

            dbdata.forEach(function (item) {
                var str, arr;
                if (item['photos']) {
                    str = item['photos'];
                    arr = str.split(',').map(function (x) {
                        return { id: +x };
                    });
                    item['photos'] = arr;
                }
                if (item['faces']) {
                    str = item['faces'];
                    //if (req.query.poicat || req.query.poi) {
                    //debug(str);
                    if (str === 'null') {
                        delete item.faces;
                    } else {
                        arr = JSON.parse(str);
                    }
                    //debug(arr);
                    //} else {
                    //    arr = str.split(',').map(function (x) {
                    //        return +x;
                    //    });
                    //}
                    item['faces'] = arr;
                }
            });

            function getChildren(id, arr) {
                var res = [];
                arr.forEach(function (x) {
                    if (x.map_icon) {
                        x.iconCls = x.map_icon.replace(/(\w*)\/(\w*)/, 'poi-$1-$2')
                    }
                    if (+x['id_parent'] === +id) {
                        var children = getChildren(x['id'], arr);
                        if (children) {
                            x.expanded = false;
                            x.children = children;
                        }
                        else {
                            x.leaf = true;
                        }
                        x.id = +x.id;
                        x.checked = false;
                        res.push(x);
                    }
                });
                return res.length > 0 ? res : null;
            }

            if (req.query.poicat || req.query.poicategory) {
                dbdata = getChildren(0, dbdata);
            }

            if (req.query.callback) {
                res.jsonp(dbdata);
            }
            else {
                res.json(dbdata);
            }
        }
    });
}
));

module.exports = router;
