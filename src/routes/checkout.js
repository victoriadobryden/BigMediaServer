const express = require('express')
const router = express.Router()

const log = require('../lib/log')(module)
const sql = require('mssql')
const transporter = require('../lib/mail')
const locales = require('../lib/locales')
const dateFormat = require('dateformat')
const HTML = require('html-template-tag')

function sendConfirmMail (firstName, lastName, email, authCode, locale) {
  const sendMail = transporter.templateSender(
    locales.confirmEmail[locale],
    { from: '"Bigmedia" <noreply@bigmedia.ua>', attachments: locales.attachments })

  const mailOptions = {
    to: email
  }
  sendMail(mailOptions, {
    name: firstName + ' ' + lastName,
    authCode: authCode
  }, function (err, info) {
    if (err) {
      throw err
    } else {
      log.debug('Confirm email sent')
    }
  })
  // transporter.sendMail(mailOptions, function(err, info){
  //    if(err){
  //        return log.error(err)
  //    }
  //    debug('Message sent: ' + info.response)
  // })
}

function sendCopyOrder (data) {
  const sendMail = transporter.templateSender(locales.orderCopyEmail[data.order.locale], {
    from: '"Bigmedia" <noreply@bigmedia.ua>', attachments: locales.attachments
  })
  const mailOptions = {to: data.order.email}
  const dateBeg = new Date(data.order.date_beg)
  const dateEnd = new Date(data.order.date_end)

  sendMail(mailOptions, {
    name: data.order.firstname + ' ' + data.order.lastname,
    period: dateFormat(dateBeg, 'dd.mm.yyyy') + ' - ' + dateFormat(dateEnd, 'dd.mm.yyyy'),
    idOrder: data.order.id
    // faces: html
  }, function (err, info) {
    if (err) {
      throw err
    } else {
      log.debug('Copy Order email sent')
      sendReportMan(data)
    }
  })
}

function sendReportMan (data) {
  const logtime = dateFormat(data.order.logtime, 'dd.mm.yyyy HH:MM:ss')
  const dateBeg = new Date(data.order.date_beg)
  const dateEnd = new Date(data.order.date_end)
  const period = dateFormat(dateBeg, 'dd.mm.yyyy') + '-' + dateFormat(dateEnd, 'dd.mm.yyyy')

  const text = `Здравствуйте. ${logtime} поступил заказ № ${data.order.id} на рекламную кампанию.
Подробности: \nИмя клента: ${data.order.firstname} ${data.order.lastname}
Организация: ${data.order.organization}
Период: ${period}`

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
    <p>Здравствуйте. <b>${logtime}</b> поступил заказ № <b>${data.order.id}</b> на рекламную кампанию.</p>
    <p>Подробности:
      <br>Имя клента: <b>${data.order.firstname} ${data.order.lastname}</b>
      <br>Email: <b>${data.order.email}</b><br>Телефон: <b>${data.order.phone}</b>
      <br>Организация: <b> ${data.order.organization}</b>
      <br>Период: <b>${period}</b>
      <br>Примечание: <b>${data.order.note}</b>
      <br></p><p>Плоскости:<br>
      <table>
      <tbody><tr><td>FaceNo</td><td>Город</td><td>Адрес</td><td>A/B</td><td>Размер</td><td>DoorsNo</td><td>Стороны</td></tr>
      ${data.faces.map(f => HTML`<tr>
      <td>${f.num}</td>
      <td>${f.city}</td>
      <td>${f.address}</td>
      <td>${f.cat}</td>
      <td>${f.sizetype}</td>
      <td>${f.doors_no}</td>
      <td>${f.sides}</td>
      </tr>`)}
      </tbody>
      </table>
    </p>
    ${[managersHTML]}
  </body></html>`

  const mailMansOptions = {
    from: '"Bigmedia website" <noreply@bigmedia.ua>', // sender address
    to: 'sales@bigmedia.ua',     // list of receivers
    // to: 'ustiloff@bigboard.ua', // list of receivers
    subject: '✔ Поступил заказ с сайта Бигмедиа', // Subject line
    text,
    html
  }

  transporter.sendMail(mailMansOptions, function (err, info) {
    if (err) {
      throw err
    } else {
      log.debug('New Order email sent')
    }
  })
}

function sendMailNotifications (idOrder) {
  const request = new sql.Request()
  request.input('idOrder', sql.Int, idOrder)
  request.execute('sp_web_order_details', function (err, recordsets, returnValue, affected) {
    if (err) {
      log.error('DB order details error: ' + 'Status: ' + err.status + '. Error message: ' + err.message)
      return
    }
    if (recordsets.length === 0) {
      log.error('DB order details error: recordsets is empty ' + 'Status: ' + err.status + '. Error message: ' + err.message)
      return
    }
    const data = {}
    if (recordsets.length > 0) {
      const recs = recordsets[0]
      if (recs.length === 0) {
        log.error('DB order details error: order not found ' + 'Status: ' + err.status + '. Error message: ' + err.message)
        return
      } else {
        // const order = {firstName: recs[0].firstname, lastName: recs[0].lastname, organization: recs[0].organization,
        // phone: recs[0].phone, dateBeg: recs[0].date_beg, dateEnd: recs[0].date_end, note: recs[0].note,
        // locale: recs[0].locale, logtime: recs[0].logtime}
        // data.order = order
        data.order = Object.keys(recs[0]).reduce(function (data, key) {
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
      const faces = recordsets[2]
      data.faces = []
      faces.forEach(function (fRec) {
        const converted = Object.keys(fRec).reduce(function (data, key) {
          data[key] = fRec[key]
          return data
        }, {})
        data.faces.push(converted)
      })
      sendCopyOrder(data)
    }
  })
}

function verifyAuthCode (idOrder, authCode) {
  const request = new sql.Request()
  request.input('idOrder', sql.Int, idOrder)
  request.input('authCode', sql.Int, authCode)
  request.execute('sp_web_order_check_code', function (err, recordsets, returnValue, affected) {
    if (err) {
      log.error('DB order details error: ' + 'Status: ' + err.status + '. Error message: ' + err.message)
      return false
    }
    if (recordsets.length === 0) {
      log.error('DB order details error: recordsets is empty ' + 'Status: ' + err.status + '. Error message: ' + err.message)
      return false
    }
    if (returnValue > 0) {
      sendMailNotifications(idOrder)
      return true
    } else {
      return false
    }
  })
}

router.post('/', function (req, res, next) {
  const {idOrder, authCode} = req.body
  if (idOrder && authCode) {
    if (verifyAuthCode(idOrder, authCode)) {
      sendMailNotifications(idOrder)
      res.json({
        success: true, // note this is Boolean, not string
        idOrder,
        verified: true,
        msg: "Order processed. Thank you. We'll contact you asap."
      })
      return
    } else {
      res.json({
        'success': true, // note this is Boolean, not string
        'verified': false,
        'msg': 'Order saved. Email verification is needed.'
      })
      return
    }
  } else if (req.body.faces) {
    const phone = '(' + req.body.phoneCode + ')' + req.body.phoneNumber
    const authCode = Math.round(Math.random() * 1000000)
    const host = req.ip
    const dateBeg = new Date(req.body.dateBeg)
    const dateEnd = new Date(req.body.dateEnd)
    const request = new sql.Request()
    request.input('firstname', sql.NVarChar(200), req.body.firstName)
    request.input('lastname', sql.NVarChar(200), req.body.lastName)
    request.input('email', sql.NVarChar(200), req.body.email)
    request.input('organization', sql.NVarChar(200), req.body.organization)
    request.input('phone', sql.NVarChar(200), phone)
    request.input('date_beg', sql.DateTime(), dateBeg)
    request.input('date_end', sql.DateTime(), dateEnd)
    request.input('note', sql.NVarChar(2000), req.body.note)
    request.input('faces', sql.VarChar(sql.MAX), req.body.faces.toString())
    request.input('locale', sql.VarChar(5), req.body.locale)
    request.input('host', sql.VarChar(200), host)
    request.input('authcode', sql.VarChar(10), authCode)
    request.execute('sp_web_addorder', function (err, recordsets, returnValue, affected) {
      if (err) {
        res.json({
          'success': false, // note this is Boolean, not string
          'msg': 'System error. Sorry, try again later.'
        })
        log.error('DB addorder error: ' + 'Status: ' + err.status + '. Error message: ' + err.message)
        return
      }
      if (recordsets.length === 0) {
        res.json({
          'success': false, // note this is Boolean, not string
          'msg': 'System error. Sorry, try again later.'
        })
        log.error('DB addorder error: recordsets is empty' + 'Status: ' + err.status + '. Error message: ' + err.message)
        return
      }
      const idOrder = returnValue
      if (recordsets.length > 0) {
        const recs = recordsets[0]
        if (recs.length === 0) {
          sendConfirmMail(req.body.firstName, req.body.lastName, req.body.email, authCode, req.body.locale)
          res.json({
            'success': true, // note this is Boolean, not string
            'authCode': authCode,
            'idOrder': idOrder,
            'verified': false,
            'msg': 'Order saved. Email verification is needed.'
          })
          return
        }
        const managers = []
        sendMailNotifications(idOrder)
        res.json({
          'success': true, // note this is Boolean, not string
          'idOrder': idOrder,
          'verified': true,
          'msg': "Order processed. Thank you. We'll contact you asap."
        })
        return
      }
    })
    // res.json({
    //    "success": false, // note this is Boolean, not string
    //    "msg":"Unknown error"
    // })
  } else {
    res.json({
      'success': false, // note this is Boolean, not string
      'msg': 'No faces were received'
    })
  }
})

module.exports = router
