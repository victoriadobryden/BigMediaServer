const express = require('express')
const router = express.Router()

const log = require('../lib/log')(module)
const sql = require('mssql')
const transporter = require('../lib/mail')
const dateFormat = require('dateformat')
const HTML = require('html-template-tag')

function sendReportMan (data) {
  const logtime = dateFormat(data.request.logtime, 'dd.mm.yyyy HH:MM:ss')

  const text = `Здравствуйте. ${logtime} поступил запрос на промокод (скидку).
Подробности: \nИмя клента: ${data.request.name}
Организация: ${data.request.organization}
Комментарий: ${data.request.message}`

  const managersHTML = data.mans.length === 0 ? ''
  : HTML`<p>В базе есть привязки к менеджерам:<br>
  <table><tbody><tr><td>Имя</td><td>Email</td><td>Клиент в базе</td><td>Менеджер</td></tr>
  ${data.mans.map(f => HTML`<tr>
    <td>${f.client_name}</td>
    <td>${f.client_email}</td>
    <td>${f.client_org}</td>
    <td>${f.manager}</td>
  </tr>`)}
  </tbody></table>
  </p>`

  const html = HTML`<html>
    <head><META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=utf8"></head>
    <body>
    <p>Здравствуйте. <b>${logtime}</b> поступил поступил запрос на промокод (скидку).</p>
    <p>Подробности:
      <br>Имя клента: <b>${data.request.name}</b>
      <br>Email: <b>${data.request.email}</b>
      <br>Организация: <b> ${data.request.organization}</b>
      <br>Примечание: <b>${data.request.message}</b>
    </p>
    ${[managersHTML]}
  </body></html>`

  const mailMansOptions = {
    from: '"Bigmedia website" <noreply@bigmedia.ua>', // sender address
    to: 'sales@bigmedia.ua',     // list of receivers
    // to: 'ustiloff@bigboard.ua', // list of receivers
    subject: 'Клиенты хотят скидку', // Subject line
    text,
    html
  }

  transporter.sendMail(mailMansOptions, function (err, info) {
    if (err) {
      throw err
    } else {
      log.debug('Promocode (discount) email sent')
    }
  })
}

function sendMailNotifications (idRequest) {
  const request = new sql.Request()
  request.input('idRequest', sql.Int, idRequest)
  request.execute('sp_web_discount_request_details', function (err, recordsets, returnValue, affected) {
    if (err) {
      log.error('DB discount request details error: ' + 'Status: ' + err.status + '. Error message: ' + err.message)
      return
    }
    if (recordsets.length === 0) {
      log.error('DB discount request details error: recordsets is empty ' + 'Status: ' + err.status + '. Error message: ' + err.message)
      return
    }
    const data = {}
    if (recordsets.length > 0) {
      const recs = recordsets[0]
      if (recs.length === 0) {
        log.error('DB discount request details error: request not found ' + 'Status: ' + err.status + '. Error message: ' + err.message)
        return
      } else {
        data.request = Object.keys(recs[0]).reduce(function (data, key) {
          data[key] = recs[0][key]
          return data
        }, {})
      }
      const mans = recordsets[1]
      data.mans = []
      mans.forEach(function (manRec) {
        const converted = Object.keys(manRec).reduce(function (data, key) {
          data[key] = manRec[key]
          return data
        }, {})
        data.mans.push(converted)
      })
      sendReportMan(data)
    }
  })
}

router.post('/', function (req, res, next) {
  const {name, email} = req.body
  if (name && email) {
      const host = req.ip
      const request = new sql.Request()
      request.input('name', sql.NVarChar(200), req.body.name)
      request.input('email', sql.NVarChar(200), req.body.email)
      request.input('organization', sql.NVarChar(200), req.body.organization)
      request.input('message', sql.NVarChar(2000), req.body.message)
      request.input('host', sql.VarChar(200), host)
      request.execute('sp_web_adddiscountrequest', function (err, recordsets, returnValue, affected) {
        if (err) {
          res.json({
            'success': false, // note this is Boolean, not string
            'msg': 'System error. Sorry, try again later.'
          })
          log.error('DB addrequest error: ' + 'Status: ' + err.status + '. Error message: ' + err.message)
          return
        }
        if (recordsets.length === 0) {
          res.json({
            'success': false, // note this is Boolean, not string
            'msg': 'System error. Sorry, try again later.'
          })
          log.error('DB addrequest error: recordsets is empty' + 'Status: ' + err.status + '. Error message: ' + err.message)
          return
        }
        const idRequest = returnValue
        if (recordsets.length > 0) {
          const recs = recordsets[0]
          const managers = []
          sendMailNotifications(idRequest)
          res.json({
            'success': true, // note this is Boolean, not string
            'idRequest': idRequest,
            'msg': "Request processed. Thank you. We'll contact you asap."
          })
          return
        }
      })
  } else {
    res.json({
      'success': false, // note this is Boolean, not string
      'msg': 'Bad form data'
    })
  }
})

module.exports = router
