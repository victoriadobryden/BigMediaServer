const express = require('express')
const {sequelize} = require('../models')
const {asyncMW} = require('../utils/async')

const log = require('../lib/log')(module)
const transporter = require('../lib/mail')
const locales = require('../lib/locales')
const dateFormat = require('dateformat')
const HTML = require('html-template-tag')

const router = express.Router()

function sendClientConfirmCheckoutMail (name, email, phone, facesClientHtml, locale) {
  const clonedTemplate = Object.assign({}, locales.easyboardConfirmCheckout[locale]);
  const now = new Date(),
    isWorkingHours = now.getDay() >=1 && now.getDay() <= 5 && now.getHours() >=8 && now.getHours() <=19,
    addMsg = isWorkingHours ? "Менеджер зв’яжеться з вами зовсім скоро" : "Менеджер зв’яжеться з вами в найближчий робочий час";
  let insertHtml = facesClientHtml + HTML`<p>${addMsg}</p>`
  clonedTemplate.html = clonedTemplate.html.toString().replace('{{facesClientHtml}}', insertHtml);
  const sendMail = transporter.templateSender(
    clonedTemplate,
    { from: '"EasyBoard" <noreply@bigmedia.ua>', attachments: locales.ebAttachments})

  const mailOptions = {
    to: email
  }
  sendMail(mailOptions, {
    // facesClientHtml
  }, function (err, info) {
    if (err) {
      throw err
    } else {
      log.debug('Easy Board checkout saved email sent')
    }
  })
}

router.post('/message', asyncMW(async (req, res) => {
  const props = req.body
  const {face, email, phone, name, message} = props
  if (!face || (!email && !phone)) {
    throw Error('wrong input data for easyboard save checkout')
  }
  const result = await sequelize.query(`
      exec sp_web_easyboardmessage
      @id_face     = :id_face,
      @email      = :email,
      @phone      = :phone,
      @name       = :name,
      @message    = :message,
      @ip         = :ip
    `, { replacements: {
        id_face: face.id,
        email: email,
        phone: phone,
        name: name,
        message: message,
        ip: req.ip
      }, type: sequelize.QueryTypes.SELECT })

  if (!result || !result.length) {
    throw Error('easyboard message saving failed')
  }
  res.status(200)
  res.json({})
  const messageData = {
    name: name,
    email: email,
    phone: phone,
    message: message,
    face: face
  }
  sendMessageNotificationToSales(messageData)
}))

router.post('/checkout', asyncMW(async (req, res) => {
  const props = req.body
  const {faces, email, phone, name} = props
  // console.warn([faces, pois, startDate, endDate, cities, email, phone, poicats, algorithm]);
  if (!faces || !faces.length || (!email && !phone)) {
    throw Error('wrong input data for easyboard save checkout')
  }
  const facesxml = '<face ' + faces.map( f =>'id="' + f.faceId + '" price="' + Math.round(f.price / 1.2 * 10000) / 10000 + '" pub_price="' + Math.round(f.price / 1.2 * 10000) / 10000 + '" by_planner="2" date_beg="' + f.startDate + '" date_end="' + f.endDate + '" print_cost="' + Math.round(f.printCost / 1.2 * 10000) / 10000 + '" delivery_cost="' + Math.round(f.deliveryCost / 1.2 * 1000) / 1000 + '">').join('</face><face ') + '</face>'
  let campNote = "Вказані контактні дані: \nІм\'я: " + name + "Email: " + email + "\n" + "Тел.: " + phone + "\n"
  const monthes = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру']
  const totalBudget = faces.reduce((res, f)=>res + f.total, 0)
  const campName = "EasyBoard: " + faces.length + ' бордів, бюджет - ' + totalBudget
  const result = await sequelize.query(`
      exec sp_web_easyboardcheckout
      @faces      = :faces,
      @camp_name  = :campName,
      @note       = :campNote,
      @email      = :email,
      @phone      = :phone,
      @name       = :name
    `, { replacements: {
        faces: facesxml,
        campName: campName,
        campNote: campNote,
        email: email,
        phone: phone,
        name: name
      }, type: sequelize.QueryTypes.SELECT })

  if (!result || !result.length) {
    throw Error('easyboard checkout saving failed')
  }
  res.status(200)
  const lastRecord = result[result.length-1]
  // res.json(lastRecord)
  res.json({})
  const campaignId = lastRecord.campaignId
  const pubCampaignId = lastRecord.pubCampaignId
  const pubCampaignUrl = 'http://probillboard.com/Presenter/?uuid=' + pubCampaignId
  const facesClientHtml = HTML`<table style='font-family:"Rubik Medium";color:#111111;'>` + faces.map((f) => {
    let periodText = f.periodText.replace(/ /g,'&nbsp;');
    return HTML`<tr><td width="100"><a href="https://bma.bigmedia.ua/photohub/face/${f.faceId}"><img src="https://bma.bigmedia.ua/photohub/face/${f.faceId}" width="100" border="0"></a></td><td style="margin: 20px;">${f.address}<br>${f.network}  ${f.size}</td><td style="text-align: end;"><span style="white-space: pre; display: inline-block; width: max-content;">${f.periodText}</span><br><span style="font-weight: bold">${f.total}&nbsp;₴</span></td></tr>`
  }).join('') + '</table>'
  sendClientConfirmCheckoutMail(name, email, phone, facesClientHtml, 'ukr')
  const facesManagerHtml = HTML`<table>` +faces.map((f) => {
    // let createdAt = dateFormat(f.createdAt, 'dd.mm.yyyy HH:MM')
    let createdAt = new Date().toLocaleString('ru-RU')
    let periodText = f.periodText.replace(/ /g,'&nbsp;');
    return HTML`<tr><td width="100"><a href="https://bma.bigmedia.ua/photohub/face/${f.faceId}"><img src="https://bma.bigmedia.ua/photohub/face/${f.faceId}" width="100" border="0"></a></td><td style="margin: 20px;">${f.address}<br>${f.network}  ${f.size}</td><td style="text-align: end;"><span style="white-space: pre; display: inline-block; width: max-content;">${f.periodText}</span><br><span style="font-weight: bold">${f.total}&nbsp;₴</span></td><td>Запис створено:<br>${createdAt}</td></tr>`
  }).join('') + '</table>'
  const salesData = {
    campaignId: campaignId,
    pubCampaignUrl: pubCampaignUrl + '&preview=true',
    name: name,
    email: email,
    phone: phone,
    facesHtml: facesManagerHtml
  }
  sendNotificationToSales(salesData)
}))

function sendMessageNotificationToSales (data) {
  const logtime = new Date().toLocaleString('uk-UA')
  data.face.doorsNo = data.face.doorsNo || '-';
  let text = `Доброго дня. ${logtime} клієнт на сайті easyboard.com.ua відправив повідомлення.
Клієнт заповнив наступні поля:
Ім'я: ${data.name}
Email: ${data.email}
Телефон: ${data.phone}
Текст повідомлення: ${data.message}
Борд:
  ${data.face.supplierNo} ${data.face.supplier}
  ${data.face.city}. ${data.face.address} ${data.face.catab}
  ${data.face.network} ${data.face.size}
  №Doors: ${data.face.doorsNo}
  ${data.face.price} грн/місяць
`
  // TODO: add faces list

  const html = HTML`<html>
    <head><META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=utf8"></head>
    <body>
    <p>Доброго дня. <b>${logtime}</b> клієнт на сайті easyboard.com.ua відправив повідомлення.</p>
    <p>Клієнт заповнив наступні поля:
      <br>Ім'я: <b>${data.name}</b>
      <br>Email: <b>${data.email}</b><br>Телефон: <b>${data.phone}</b>
      <br>Текст повідомлення: <b>${data.message}</b>
      <br>
      <br>Площина:
      <br>№${data.face.supplierNo} ${data.face.supplier}
      <br>${data.face.city}. ${data.face.address} ${data.face.catab}
      <br>${data.face.network} ${data.face.size}
      <br>№Doors: ${data.face.doorsNo}
      <br>${data.face.price} грн/місяць<br>
      <br><a href="https://easyboard.com.ua/faces/${data.face.id}">Переглянути</a>
      <br><a href="https://bma.bigmedia.ua/photohub/face/${data.face.id}">Переглянути фото на BMA</a>
    </p>
  </body></html>`

  const mailMansOptions = {
    from: '"EasyBoard service" <noreply@bigmedia.ua>', // sender address
    to: ['sales@bigmedia.ua', 'oleg.morskov@bigboard.ua'],     // list of receivers
    // to: ['sales@bigmedia.ua', 'ilya.kiselov@bigmedia.com.ua', 'ustiloff@bigboard.ua'],     // list of receivers
    // to: 'ustiloff@bigboard.ua', // list of receivers
    subject: '✔ EasyBoard message', // Subject line
    text,
    html
  }

  transporter.sendMail(mailMansOptions, function (err, info) {
    if (err) {
      throw err
    } else {
      log.debug('EasyBoard Message email sent')
    }
  })
}

function sendNotificationToSales (data) {
  // const logtime = dateFormat(new Date(), 'dd.mm.yyyy HH:MM')
  const logtime = new Date().toLocaleString('uk-UA')
  let text = `Доброго дня. ${logtime} клієнт на сайті easyboard.com.ua відібрав площини.
В базі продажів була створена кампанія з номером ${data.campaignId}
Клієнт заповнив наступні поля:
Ім'я: ${data.name}
Email: ${data.email}
Телефон: ${data.phone}
`
  // TODO: add faces list

  const html = HTML`<html>
    <head><META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=utf8"></head>
    <body>
    <p>Доброго дня. <b>${logtime}</b> клієнт на сайті easyboard.com.ua відібрав площини.</p>
    <p>В базі продажів була створена кампанія з номером <b>${data.campaignId}</b></p>
    <p>Клієнт заповнив наступні поля:
      <br>Ім'я: <b>${data.name}</b>
      <br>Email: <b>${data.email}</b><br>Телефон: <b>${data.phone}</b>
      <br>
      <br>Вибрані площини:
      <br>` + data.facesHtml + `<br>
    </p>
  </body></html>`

  const mailMansOptions = {
    from: '"EasyBoard service" <noreply@bigmedia.ua>', // sender address
    to: ['sales@bigmedia.ua', 'ilya.kiselov@bigmedia.com.ua', 'ustiloff@bigboard.ua'],     // list of receivers
    // to: 'ustiloff@bigboard.ua', // list of receivers
    subject: '✔ EasyBoard checkout submitted', // Subject line
    text,
    html
  }

  transporter.sendMail(mailMansOptions, function (err, info) {
    if (err) {
      throw err
    } else {
      log.debug('New EasyBoard Order email sent')
    }
  })
}

module.exports = router
