/**
 * Created by Alexander.Ustilov on 12.01.2016.
 */

var conf = require('../config/index.js');
var sql = require('mssql');
var debug = require('debug')('ol-app:server');
var encoding = require('encoding');

function execSql(sqlqry,cb){
  sql.connect(conf.get('dbConfig'))
    .then(function(){
      sqlReq = new sql.Request();
      var winqry = encoding.convert(sqlqry, 'win1251', 'utf8').toString();
      sqlReq.query(winqry)
        .then(function(recordset){
          var dbdata = recordset.map(function (item) {
            var converted = {};
            for (var key in item) {
              if (!item.hasOwnProperty(key)) continue;
              converted[key] = encoding.convert(String(item[key]), 'utf8', 'win1251').toString();
            }
            return converted;
          });
          cb(dbdata);
        }).catch(function(err){
          log.error('Status: ' + err.status + '. Query error message: ' + err.message);
        });
    })
    .catch(function(err){
      console.log(err);
      cb(null,err);
    });
}

module.exports = execSql;
