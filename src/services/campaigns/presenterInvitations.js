const {PublishedCampaign, Campaign, PresenterInvitation, User} = require('../../models')
const {decorate} = require('../decorators')
const qr = require('qr-image')

const transporter = require('../../lib/mail')

function sendInvitationEmail (email, publishedCampaign) {
  const {id, email: senderEmail, campaign: {name: campaignName}, owner: {name: ownerName}} = publishedCampaign
  const link = `http://probillboard.com/Presenter/?uuid=${id}`
  const linkQR = qr.imageSync(link, {type: 'png'})
  const attachments = [{
    filename: 'qrcode.png',
    content: linkQR,
    cid: 'qrcode.png'
  }]
  const sendMail = transporter.templateSender({
    subject: `Adv. campaign presentation`,
    text: `Добрий день.
${ownerName} підготував(ла) для Вас презентацію рекламної кампанії '${campaignName}'.
Ви можете відкрити її, натиснувши тут ${link}

Hello.
${ownerName} has been prepared outdoor advertising campaign '${campaignName}' for you.
You can see it here: ${link}`,
    html: `
<p>Добрий день.</p>
<p>${ownerName} підготував(ла) для Вас презентацію рекламної кампанії '${campaignName}'.</p>
<p>Ви можете відкрити її, натиснувши <a href="${link}">тут</a></p>
<br>
<p>Hello.</p>
<p>${ownerName} has been prepared outdoor advertising campaign '${campaignName}' for you.</p>
<p>You can see it <a href="${link}">here</a></p>

<p><img src="cid:qrcode.png"></p>`
  }, {
    from: senderEmail,
    replyTo: senderEmail,
    attachments
  })

  sendMail({ to: email }, {}, function (err, res) {
    if (err) console.error('Error sending invitation email', err)
  })
}

async function create ({publishedCampaignId, email}) {
  if (!email) throw Error('400: email is missing')
  const publishedCampaign = await PublishedCampaign.rls().findOne({
    where: {id: publishedCampaignId},
    include: [
      { model: Campaign },
      { model: User, as: 'owner' }
    ]
  })
  if (!publishedCampaignId) throw Error(404)
  const presenterInvitation = await PresenterInvitation.create({publishedCampaignId, email})
  sendInvitationEmail(email, publishedCampaign)
  return presenterInvitation
}

module.exports = {
  create: decorate(create, {permissions: {showProposalCard: 2}, transactional: {}})
}
