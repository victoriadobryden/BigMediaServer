const {decorate} = require('./decorators')
const SQL = require('sql-template-strings')
const sequelize = require('../models/sequelize')

async function list (dixes) {
  if (dixes) {
    let doors_numbers = dixes.join(',')
    doors_numbers = doors_numbers.replace(/'/g, '')
    const sql = SQL`exec sp_web_thirdparty @doors_numbers=${doors_numbers}`
    const results = await sequelize.query(sql)
    return results
  }
}

module.exports = {
  list: decorate(list, {transactional: {}})
}
