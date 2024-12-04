/**
 * Created by Oleg.Morskov on 04.09.2023.
 */

const conf = require('../config').get('PG'),
    //{ Client, Query , Pool } = require('pg'),
    Pool = require('pg').Pool,
    Client= require('pg').Client

//const { Query , Client, Pool } = require('pg');
const pgClient = new Pool(conf)
var conn_status, attempts = 0;

function connectToDB(cb){
  // const pgClient = new Pool(conf)
  pgClient.connect()
    .then(function(){
      conn_status = 'connected';
      // console.warn('PG',conn_status)
      cb();
    })
    .catch(function(err){
      conn_status = 'error';
      // console.warn('PG',conn_status)
      attempts++;
      console.log(err);
      cb(null,err);
    });
}
async function pgquery(query,cb) {
  
  const {rows, fields} = await pgClient.query(query);
  // console.warn(rows)
  cb(rows);
}
async function exec(sqlqry,cb) {
  // const pgClient = new Pool(conf);
  try {
    // await pgClient.connect();
    const { rows }  = await pgClient.query(sqlqry); // sends query
    // console.warn(rows);
    cb(null,rows);
  } catch (error) {
    cb(error);
  } 
  // finally {
  //   await pgClient.end();        // closes connection
  // }
}

function PGDB(){
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
  this.query = (query, cb)=>{
    if(conn_status=='connected'){
      pgquery(query, cb);
    }
    else{
      //debug('New connection');
      connectToDB(()=>{pgquery(query,cb);})
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

module.exports = new PGDB();
