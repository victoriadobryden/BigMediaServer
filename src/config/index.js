const nconf = require('nconf')
const defaults = {
  'LOG': 'info',
  'PORT': 3000,
  'EMAIL': {
    'host': 'mail.bigboard.ua',
    'port': 2525,
    'user': 'request@bigmedia.com.ua',
    'password': 'De8cTy'
  },
  'DB': {
    'user': 'web',
    'password': '05www08@))#',
    'server': 'mssql.ua.local',
    'port': 1443,
    'database': 'BigBoard',
    'useUTC': false,
    'useColumnNames': false,
    'requestTimeout': 360000,
    'pool': {
      'max': 20,
      'min': 0
    }
  },
  "PG": {
    'user': 'bb_admin',
    'host': '10.10.100.3',
    'database': 'BigBoard',
    'password': '08sas07UA',
    'port': 5432
  },
  'REDIS': 'redis://localhost:6379',
  'SESSION_SECRET': 'dqlichSU6kdh2354JHDgejdWTFSeudygid28GXuye9',
  'PHOTO': {
    'unc': '\\\\appserver\\PhotoRep\\PhotoReports\\Print',
    'http': 'http://bma.bigmedia.ua/PhotoRep'
  },
  'FACEBOOK': {
    'clientID': '1308134669200550',
    'clientSecret': 'aa06639f6d0d9edec7172d5e8ea80c1b'
  },
  'refreshBigData': {
    'workingHoursTimeout': 600000,
    'otherTimeout': 600000
  }
}

nconf.argv({
  'c': {
    alias: 'config'
  }
})

const configFile = nconf.get('config')
if (configFile) nconf.file(configFile)
nconf.env('__')
nconf.defaults(defaults)
module.exports = nconf
