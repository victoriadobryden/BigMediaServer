const nodemailer = require('nodemailer')
const config = require('../config').get('EMAIL')
const transporter = nodemailer.createTransport({
  host: config.host,
  port: config.port,
  ignoreTLS: true,
  auth: {
    user: config.user,
    pass: config.password
  }
})
module.exports = transporter
