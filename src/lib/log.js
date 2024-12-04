/**
 * Created by Alexander.Ustilov on 02.11.2015.
 */
const winston = require('winston')
const util = require('util')
// const npmLevels =                     'error,warn,info,verbose,debug,silly'
const syslogLevels = 'emerg,alert,crit,error,warn,notice,info,debug'.split(',')
const syslogMarkers = syslogLevels.reduce((acc, it, i) => Object.assign(acc, {[it]: `<${i}>`}), {})

//const logger = new winston.Logger({
const logger = new (winston.Logger)({
  transports: [
    new winston.transports.Console({
      colorize: true,
      level: require('../config').get('LOG'),
      formatter: function (options) {
        // Return string will be passed to logger.
        return syslogMarkers[options.level] + (undefined !== options.message ? options.message : '') +
          (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '')
      }
    })
  ]})

function formatArgs (args) {
  return [util.format.apply(util.format, Array.prototype.slice.call(args))]
}

console.log = function () { logger.debug.apply(logger, formatArgs(arguments)) }
console.info = function () { logger.info.apply(logger, formatArgs(arguments)) }
console.warn = function () { logger.warn.apply(logger, formatArgs(arguments)) }
console.error = function () { logger.error.apply(logger, formatArgs(arguments)) }
console.debug = function () { logger.debug.apply(logger, formatArgs(arguments)) }

module.exports = function getLogger (module) {
  return logger
}
