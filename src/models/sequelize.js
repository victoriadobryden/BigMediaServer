const Sequelize = require('sequelize')
const config = require('../config')
const db = config.get('DB')
const appCtx = require('continuation-local-storage').getNamespace('app')
Sequelize.cls = appCtx

const sequelizeOpts = {
  host: db.server,
  port: db.port,
  dialect: 'mssql',
  pool: db.pool,
  databaseVersion: '9.0.1399',
  define: {
    timestamps: false,  // I don't want timestamp fields by default
    freezeTableName: true
  },
  dialectOptions: {
    requestTimeout: 300000
    // options: {
    //   requestTimeout: 300000
    // }
    // abortTransactionOnError: true,
  },
  benchmark: true,
  query: {
    type: 'SELECT',
    raw: false
  },
  //logging: null
  // timezone: 'UTC'
}
/*
if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development') {
  sequelizeOpts.logging = null
}
*/

//  https://github.com/sequelize/sequelize/issues/381#issuecomment-31603459
//  mickhansen commented on Jan 5, 2014
//  You should be able to require and modify https://github.com/sequelize/sequelize/blob/master/lib/data-types.js before init'ing sequelize.

const dataTypesFor2005MSSQLHack = require('sequelize/lib/data-types')
dataTypesFor2005MSSQLHack.mssql.DATE.prototype.toSql = function () {
  return 'DATETIME'
}

// sequelize doesn't want defaultScope to be a function https://github.com/sequelize/sequelize/issues/6126
// so we will add Model.prototype.$ as shorthand for Model.prototype.scope('$')
const Model = require('sequelize/lib/model')

Model.prototype.updateOne = async function updateOne (props, opts) {
  const selected = await this.findOne(Object.assign({}, opts, {attributes: ['id']}))
  if (!selected) throw Error(404)
  const opts2 = Object.assign({}, opts, {returning: false})
  const [count] = await this.update(props, opts2)
  console.assert(count === 0 || count === 1)
  return count
}

Model.prototype.destroyOne = async function destroyOne (opts) {
  const selected = await this.findOne(Object.assign({}, opts, {attributes: ['id']}))
  if (!selected) throw Error(404)
  const count = await this.destroy(opts)
  console.assert(count === 0 || count === 1)
  return count
}

Model.prototype.rls = function (...otherScopes) {
  return this.scope('rls', ...otherScopes)
}

function findSameInclude (model, options, scopeInclude) {
  return options.include.find(item => {
    const isSameModel = item.model && item.model.name === scopeInclude.model.name
    if (!isSameModel || !item.as) return isSameModel

    if (scopeInclude.as) {
      return item.as === scopeInclude.as
    } else {
      var association = scopeInclude.association || model.getAssociation(scopeInclude.model, scopeInclude.as)
      return association ? item.as === association.as : false
    }
  })
}

let injectScopeOrig = Model.prototype.$injectScope
function injectRLSScope (model, options, scope) {
  // append where condition to options from scope, if defined
  if (scope.where) {
    options.where = options.where ? {$and: [options.where, scope.where]} : scope.where
  }

  if ('required' in scope) {
    options.required = scope.required
  }

  // allow only attributes from scope if some where defined
  if (scope.attributes && scope.attributes.length) {
    if (!options.attributes) {
      options.attributes = scope.attributes
    } else {
      const filteredAttributes = options.attributes.filter(attr => scope.attributes.some(scopeAttr => scopeAttr === attr))
      if (filteredAttributes.length !== options.attributes.length) {
        console.warn('Some attributes were filtered by RLS')
      }
      options.attributes = filteredAttributes
    }
  }

  // add include from scope, if defined
  // if there is the same include in options then merge it by calling this function recoursively
  // otherwise just add scope include to options
  if (scope.include) {
    options.include = options.include || []
    scope.include.forEach(scopeInclude => {
      const sameIncludeFromOptions = findSameInclude(model, options, scopeInclude)
      if (sameIncludeFromOptions) {
        injectRLSScope(scopeInclude.model, sameIncludeFromOptions, scopeInclude)
      } else {
        options.include.push(scopeInclude)
      }
    })
  }
}

Model.prototype.$injectScope = function injectScopeOverride (options) {
  if (!this.$scope.rls) return injectScopeOrig.call(this, options)
  return injectRLSScope(this, options, this.$scope)
}

const sequelize = new Sequelize(db.database, db.user, db.password, sequelizeOpts)

function setUserContextInfo () {
  const ctx = Sequelize.cls
  const ip = ctx.get('ip')
  const user = ctx.get('user')
  const userId = user && user.id
  const contextObj = {ip, userId}
  // TODO - escape xml value
  const contextInfoXML = '<c ' + Object.keys(contextObj).map(k => `${k}="${contextObj[k] || ''}"`).join(' ') + '/>'
  // const contextInfo = new Buffer(contextInfoXML, 'utf8').toString('hex')
  contextInfo = Buffer.from(contextInfoXML, 'utf8').toString('hex')
  console.log(`SET CONTEXT_INFO 0x${contextInfo}`)
  return sequelize.query(`SET CONTEXT_INFO 0x${contextInfo}`)
}

function maybeTransaction (opts, fn) {
  if (typeof opts === 'function') {
    fn = opts
    opts = undefined
  }
  const tx = Sequelize.cls.get('transaction')
  return tx ? fn(tx) : sequelize.transaction(opts, tx => setUserContextInfo().then(_ => fn(tx)))
}

function checkTransaction () {
  const tx = Sequelize.cls.get('transaction')
  if (!tx) throw Error('DML must be in transaction')
}

const dmlHooksNames = [
  'beforeCreate',
  'beforeUpdate',
  'beforeDestroy',
  'beforeDestroy'
]

dmlHooksNames.forEach(name => sequelize.addHook(name, checkTransaction))

Sequelize.prototype.maybeTransaction = maybeTransaction

module.exports = sequelize
