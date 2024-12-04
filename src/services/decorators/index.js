const decorators = {
  transactional: require('./transactional'),
  permissions: require('./permissions')
}

const unknownDecorator = name => console.assert(false, `Unknown decorator ${name}`)

const id = x => x
function decorate (f, opts) {
  const fnsAndOpts = Object.entries(opts).map(([k, v]) => ([decorators[k] || unknownDecorator(k), v]))
  const composed = fnsAndOpts.reduce((acc, [decoratorFn, decoratorOpts]) => {
    return fn => acc(decoratorFn(fn, decoratorOpts))
  }, id)
  return composed(f)
}

module.exports = {
  decorate,
  decorators
}
