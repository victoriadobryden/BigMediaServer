/**
 * Created by Alexander.Ustilov on 12.01.2016.
 */

var conf = require('../config');
var sql = require('mssql');
var debug = require('debug')('ol-app:server');


var conn_status, attempts = 0;

function connectToDB(cb){
  var dbConfig = conf.get('DB');
  sql.connect(dbConfig)
    .then(function(){
      conn_status = 'connected';
      cb();
    })
    .catch(function(err){
      conn_status = 'error';
      attempts++;
      // console.log(err);
      cb(null,err);
    });
}

function exec(sqlqry,cb){
  var sqlreq = new sql.Request(); // using global connection
  sqlreq.query(sqlqry)
    .then(function(recordset){
        cb(recordset);
    }).catch(function(err){
      console.error('Status: ' + err.status + '. Query error message: ' + err.message, err.stack);
    });
}

//function execMultiThreads(countQry, selectQry, cb)


function DB(){
  this.execSql = function (sqlqry,cb){
    if(conn_status=='connected'){
      //debug('Already connected');
      exec(sqlqry,cb);
    }
    else{
      //debug('New connection');
      connectToDB(function(){exec(sqlqry,cb);})
    }
  };
  this.connectToDB = function (cb){
    connectToDB(cb);
  };
  this.execProc = function (){

  };
  this.getSql = function () {
    return sql;
  };
  this.getConnectionStatus = function () {
    return conn_status;
  }
}

module.exports = new DB();
