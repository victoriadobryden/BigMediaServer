const nodemailer = require('nodemailer')
const config = require('../config').get('EMAIL')

async function sendEmail (opts) {
    let transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      ignoreTLS: true,
      auth: {
        user: config.user,
        pass: config.password
      }
    })

    const msgOpts = Object.assign(opts, {from: '"Bigmedia robot 🤖" <' + config.mail.user + '>'})

    let info = await transporter.sendMail(
        msgOpts
    );

    // console.log('Message sent: %s', info.messageId);
}

module.exports = { sendEmail }
