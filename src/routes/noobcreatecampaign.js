const express = require('express')
const {sequelize} = require('../models')
const {asyncMW} = require('../utils/async')

const log = require('../lib/log')(module)
const transporter = require('../lib/mail')
const locales = require('../lib/locales')
const dateFormat = require('dateformat')
const HTML = require('html-template-tag')

const router = express.Router()

function sendNewCampaignMail (email, campaignPeriod, cities, poiCats, pubCampaignUrl, locale) {
  const sendMail = transporter.templateSender(
    locales.simplePlannerResult[locale],
    { from: '"Bigmedia" <noreply@bigmedia.ua>', attachments: locales.attachments })

  const mailOptions = {
    to: email
  }
  sendMail(mailOptions, {
    campaignPeriod, cities, poiCats, pubCampaignUrl
  }, function (err, info) {
    if (err) {
      throw err
    } else {
      log.debug('Noob new campaign email sent')
    }
  })
}

router.post('/', asyncMW(async (req, res) => {
  const props = req.body
  const {faces, pois, startDate, endDate, cities, email, phone, poicats, algorithm} = props
  // console.warn([faces, pois, startDate, endDate, cities, email, phone, poicats, algorithm]);
  if (!faces || !Object.values(faces).length || !startDate || !endDate) {
    throw Error('wrong input data for noob create campaign')
  }
  const poicatsxml = '<poicat id="' + poicats.join('"></poicat><poicat id="') + '"></poicat>'
  const citiesxml = '<city id="' + cities.map(c=>c.id).join('"></city><city id="') + '"></city>'
  const poisxml = '<poi id="' + pois.join('"></poi><poi id="') + '"></poi>'
  const facesxml = '<face ' + Object.values(faces).map( f =>'id="' + f.id + '" price="' + f.price + '" pub_price="' + f.price + '" by_planner="1">').join('</face><face ') + '</face>'
  let campNote = "Вказані контактні дані: \nEmail: " + email + "\n" + "Тел.: " + phone + "\n"
  campNote += "Вибраний алгоритм: \"" + algorithm + "\"\n"
  campNote += "Параметри планування кампанії: \n"
  const dateBeg = new Date(startDate)
  const dateEnd = new Date(endDate)
  // console.warn(startDate);
  // console.warn(endDate);
  // console.warn(dateBeg);
  // console.warn(dateEnd);
  // console.warn(dateFormat(dateBeg, 'dd.mm.yyyy'));
  // console.warn(dateFormat(dateEnd, 'dd.mm.yyyy'));
  // return;
  campNote += "Період: " + dateFormat(dateBeg, 'dd.mm.yyyy') + ' - ' + dateFormat(dateEnd, 'dd.mm.yyyy') + "\n"
  // console.warn(`select id_city, name from cities where id_city in (` + cities.map(c=>c.id).join(',') + `)`);
  const citiessql = (cities && cities.length > 0) ? await sequelize.query(`select id_city, name from cities where id_city in (:cities)`
    , { replacements: {
      cities: cities.map(c=>c.id)
    }, type: sequelize.QueryTypes.SELECT }) : [];
  cities.forEach((city) => {
    let cs = citiessql.find((c) => c.id_city == city.id)
    if (cs) {
      city.name = cs.name
    }
    city.params = []
    if (city.budget) {city.params.push('бюджет - ' + city.budget)}
    if (city.quantity) {city.params.push('бордів - ' + city.quantity)}
    if (city.coverage) {city.params.push('охоплення - ' + city.coverage)}
  });
  campNote += "Вибрані міста з параметрами (бюджет, кількість, охоплення): " + cities.map(c=>c.name + '(' + c.budget + ', ' + c.quantity + ', ' + c.coverage + ')').join(', ') + "\n"

  const poicatssql = (poicats && poicats.length > 0) ? await sequelize.query(`select name_uk from map_poi_category where id in (:poicats)`
    , { replacements: {
      poicats: poicats
    }, type: sequelize.QueryTypes.SELECT }) : [];
  const poicatsnames = poicatssql ? poicatssql.map(row=>row['name_uk']).join(', ') : '';
  campNote += "Вибрані категорії POI: " + poicatsnames + "\n"
  if (pois.length) {
    campNote += "Знайдено в базі об\'єктів: " + pois.length
  }
  const monthes = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'],
    startM = dateBeg.getMonth(), startY = dateBeg.getFullYear() - 2000, endM = dateEnd.getMonth(), endY = dateEnd.getFullYear() - 2000
  let periodText = monthes[startM] + "\'" + startY
  if (startM != endM || startY != endY) {
    periodText += ' - ' + monthes[endM] + "\'" + endY
  }
  const totalBudget = Object.values(faces).reduce((res, f)=>res + f.price, 0)
  const campName = "Simple BMA: " + Object.values(faces).length + ' бордів, бюджет - ' + totalBudget
  const result = await sequelize.query(`
      exec sp_web_noobcreatecampaign
      @pois       = :pois,
      @faces      = :faces,
      @cities     = :cities,
      @startDate  = :startDate,
      @endDate    = :endDate,
      @name       = :campName,
      @note       = :campNote
    `, { replacements: {
        pois: poisxml,
        faces: facesxml,
        cities: cities.map(c=>'"' + c.name + '"').join(','),
        startDate: dateBeg,
        endDate: dateEnd,
        campName: campName,
        campNote: campNote
      }, type: sequelize.QueryTypes.SELECT })

  if (!result || !result.length) {
    throw Error('create campaign for noob failed')
  }
  res.status(200)
  const lastRecord = result[result.length-1]
  res.json(lastRecord)
  const campaignId = lastRecord.campaignId
  const pubCampaignId = lastRecord.pubCampaignId
  const pubCampaignUrl = 'http://probillboard.com/Presenter/?uuid=' + pubCampaignId
  let campaignPeriod = dateFormat(dateBeg, 'dd.mm.yyyy') + ' - ' + dateFormat(dateEnd, 'dd.mm.yyyy'),
    citiesHtml = `<table><tr><th>Місто</th><th>Бюджет</th><th>Бордів</th><th>Охоплення</th></tr>`
      + `<tr>` + cities.map(c => '<td>' + c.name + '</td><td>' + (c.budget || '') + '</td><td>' + (c.quantity || '') + '</td><td>' + (c.coverage || '') + '</td>').join('</tr><tr>') + `</tr>`
      + `</table>`,
    citiesText = cities.map(c => c.name + ' (' + c.params.join('/') + ')').join(', '),
    poiCatsHtml = poicatsnames
  sendNewCampaignMail(email, campaignPeriod, citiesText, poiCatsHtml, pubCampaignUrl, 'ukr')
  const salesData = {
    campaignPeriod: campaignPeriod,
    campaignId: campaignId,
    pubCampaignUrl: pubCampaignUrl + '&preview=true',
    citiesHtml: citiesHtml,
    poiCatsHtml: poiCatsHtml,
    email: email,
    phone: phone,
    algorithm: algorithm
  }
  sendNotificationToSales(salesData)
}))

function sendNotificationToSales (data) {
  const logtime = dateFormat(new Date(), 'dd.mm.yyyy HH:MM')
  const text = `Здравствуйте. ${logtime} создана кампания посредством простого планировщика на сайте BMA.
Период кампании: ${data.campaignPeriod}
Номер кампании: ${data.campaignId}
Ссылка на презентацию: ${data.pubCampaignUrl}
Email: ${data.email}
Телефон: ${data.phone}`

  const html = HTML`<html>
    <head><META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=utf8"></head>
    <body>
    <p>Здравствуйте. <b>${logtime}</b> создана кампания посредством простого планировщика на сайте BMA.</p>
    <p>Подробности:
      <br>Период кампании: <b>${data.campaignPeriod}</b>
      <br>Номер кампании в БП: <b> ${data.campaignId}</b>
      <br>Ссылка на презентацию: <b><a href="` + data.pubCampaignUrl + HTML`">${data.pubCampaignUrl}</a></b>
      <br>Email: <b>${data.email}</b><br>Телефон: <b>${data.phone}</b>
      <br>
      <br>Параметры планировщика:
      <br>Города:<br>` + data.citiesHtml + HTML`<br>
      Категории POI:<br>
      ${data.poiCatsHtml}<br>
      Пользователь выбрал кампанию, созданную при помощи алгоритма: <b>${data.algorithm}</b>
    </p>
  </body></html>`

  const mailMansOptions = {
    from: '"Bigmedia website" <noreply@bigmedia.ua>', // sender address
    to: ['sales@bigmedia.ua', 'ilya.kiselov@bigmedia.com.ua'],     // list of receivers
    // to: 'ustiloff@bigboard.ua', // list of receivers
    subject: '✔ Создана кампания простым планировщиком', // Subject line
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

module.exports = router
