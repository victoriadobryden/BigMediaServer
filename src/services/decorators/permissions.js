const appCtx = require('continuation-local-storage').getNamespace('app')
const {Action} = require('../../models')

function objectPredicate (o) {
  const allowedActions = Object.entries(o).map(([actionName, minAccessType]) => {
    const id = Action[actionName] || console.assert(false, `Unknown action name ${actionName}`)
    return [id, minAccessType]
  })

  return function checkAction (actions) {
    return allowedActions.some(([id, minAccessType]) => actions[id] && actions[id].accessType >= minAccessType)
  }
}

function permissions (fn, condition) {
  const invalidCondition = c => { throw Error(`Invalid or unsupported condition:${c}`) }
  const predicate =
    typeof condition === 'function' ? condition
    : typeof condition === 'object' ? objectPredicate(condition)
    : invalidCondition(condition)

  return function checkPermission (...args) {
    const user = appCtx.get('user')
    if (!user) throw Error(401)
    const userActions = user.actions || {}
    const matched = predicate(userActions)
    if (!matched) throw Error(403)
    return fn(...args)
  }
}

module.exports = permissions
