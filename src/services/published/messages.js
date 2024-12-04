const {PublishedMessage, PublishedCampaign, Campaign} = require('../../models')
const {decorate} = require('../decorators')

async function byId (id) {
  return await PublishedMessage.findOne({
    where: {id}
  })
}

async function list (publishedCampaignId) {
  return await PublishedMessage.findAll({where: {publishedCampaignId}})
}

const transporter = require('../../lib/mail')
const escapeHtml = require('escape-html')

function sendMessageByEmail ({email, campaignId, campaign: {name: campaignName}}, body) {
  const sendMail = transporter.templateSender({
    subject: `[Presenter message] Campaign ${campaignId} has new message`,
    text: `Доброго дня.
Маєте повідомлення в презентації рекламної кампанії №${campaignId} (${campaignName}).
Відкрити кампанію: http://www.bigmedia.ua/client/#campaigns/${campaignId}

-----------------------------------------------------------
${body}
-----------------------------------------------------------

Hello.
You have a message in presentation of campaign #${campaignId} (${campaignName}).
Open the campaign: http://www.bigmedia.ua/client/#campaigns/${campaignId}
`,
    html: `<p>Доброго дня.<p> 
<p>Маєте повідомлення в презентації рекламної кампанії №${campaignId} (${campaignName}).
<p>Відкрити кампанію: <a href="http://www.bigmedia.ua/client/#campaigns/${campaignId}">http://www.bigmedia.ua/client/#campaigns/${campaignId}</a></p>
<hr>
<pre>
    ${escapeHtml(body)}
</pre>
<hr>
<p>Hello.</p>
<p>You have a message in presentation of campaign #${campaignId} (${campaignName}).</p>
<p>Open the campaign: <a href="http://www.bigmedia.ua/client/#campaigns/${campaignId}">http://www.bigmedia.ua/client/#campaigns/${campaignId}</a></p>
 
`
  }, {
    from: '"Bigmedia" <noreply@bigmedia.ua>'
  })

  sendMail({ to: email }, {}, function (err, res) {
    if (err) console.error('Error sending email', err)
  })
}
async function create (props) {
  const {
    publishedCampaignId,
    body
  } = props
  if (!publishedCampaignId) throw Error('404: Empty publishedCampaignId')
  const publishedCampaign = await PublishedCampaign.findOne({
    include: [{
      model: Campaign
    }],
    where: {id: publishedCampaignId}
  })
  if (!publishedCampaign) throw Error('404: Invalid publishedCampaignId')
  if (!body) throw Error('400: Body is emnpty')
  const created = await PublishedMessage.create({
    publishedCampaignId,
    body
  })

  sendMessageByEmail(publishedCampaign, body)
  return created
}

module.exports = {
  byId,
  list,
  create: decorate(create, {transactional: {}})
}
