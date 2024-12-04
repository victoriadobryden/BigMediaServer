// decorator
const sequelize = require('../../models/sequelize')
function transactional (fn, opts = {}) {
  return (...args) => sequelize.maybeTransaction(opts, _ => fn(...args))
}

module.exports = transactional
