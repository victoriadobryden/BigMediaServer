const {
  PublishedCampaign,
  Campaign,
  ViewPublishedPresenter,
  Org,
  OrgLogo,
  User,
  ProposalMix,
  UserPOI
} = require('../../models')

const {decorate} = require('../decorators')

async function byId (id) {
  const campaign = await PublishedCampaign.findOne({
    where: {
      id
    },
    include: [{
      model: User,
      as: 'owner',
      attributes: ['id'],
      include: [{
        model: Org,
        attributes: ['name'],
        include: [{
          model: OrgLogo,
          attributes: ['logo']
        }]
      }]
    }],
    raw: true,
    nest: true
  })
  if (campaign.closed || campaign.deleted) return null
  if (campaign) {
    campaign.viewPublishedProposals = await ProposalMix.findAll({where: {pubCampaignId: id}, raw: true})
    // ViewPublishedPresenter.findAll({where: {publishedCampaignId: id}, raw: true})
    if (campaign.viewPublishedProposals) {
      campaign.viewPublishedProposals.forEach(p => {
        p.photos = JSON.parse(p.photos)
      })
    }
    campaign.viewPublishedPois = await UserPOI.findAll({where: {campaignId: campaign.campaignId}, raw: true})
    // campaign.viewProposalsMix = await ViewProposalMix.findAll({where: {publishedCampaignId: id}, raw: true})
    // if (campaign.viewProposalsMix) {
    //   campaign.viewProposalsMix.forEach(p => {
    //     p.photos = JSON.parse(p.photos)
    //   })
    // }
  }
  return campaign
}

const transporter = require('../../lib/mail')

const statusesUkr = {
  'Opened': 'Відкритий',
  'Started': 'Розпочатий',
  'Reviewed': 'Завершений'
}

function sendNotificationEmail (status, publishedCampaign) {
  const {email, campaignId, campaign: {name: campaignName}} = publishedCampaign
  const campaignStatus = statusesUkr[status]
  const sendMail = transporter.templateSender({
    subject: `[Presenter notification] Campaign ${campaignId} has new client's respond`,
    text: `Доброго дня.
Маєте оновлення в презентації рекламної кампанії №${campaignId} (${campaignName}). Поточний статус: ${campaignStatus}
Відкрити кампанію: http://www.bigmedia.ua/client/#campaigns/${campaignId}

Hello.
You have updates in presentation of campaign #${campaignId} (${campaignName}). Current status is: ${status}.
Open the campaign: http://www.bigmedia.ua/client/#campaigns/${campaignId}
    `,
    html: `<p>Доброго дня.<p>
<p>Маєте оновлення в презентації рекламної кампанії №${campaignId} (${campaignName}). Поточний статус: ${campaignStatus}
<p>Відкрити кампанію: <a href="http://www.bigmedia.ua/client/#campaigns/${campaignId}">http://www.bigmedia.ua/client/#campaigns/${campaignId}</a></p>
<br>
<p>Hello.</p>
<p>You have updates in presentation of campaign #${campaignId} (${campaignName}). Current status is: ${status}.</p>
<p>Open the campaign: <a href="http://www.bigmedia.ua/client/#campaigns/${campaignId}">http://www.bigmedia.ua/client/#campaigns/${campaignId}</a></p>

`
  }, {
    from: '"Bigmedia" <noreply@bigmedia.ua>'
  })

  sendMail({ to: email }, {}, function (err, res) {
    if (err) console.error('Error sending email', err)
  })
}

async function update (id, {status}) {
  const publishedCampaign = await PublishedCampaign.findOne({
    include: [{
      model: Campaign
    }],
    where: {id}
  })
  if (!publishedCampaign) throw Error(404)
  const allowedStatuses = ['Opened', 'Started', 'Reviewed']
  if (!allowedStatuses.includes(status)) throw Error(`400: Invalid status ${status}`)
  if (publishedCampaign.status !== status) {
    await publishedCampaign.update({status})
    // publishedCampaign.status = status
    // await publishedCampaign.save()
    sendNotificationEmail(status, publishedCampaign)
  } else {
    console.warn(`Status of publishedCampaign ${id} not changed from ${status}`)
  }
  return publishedCampaign
}

module.exports = {
  byId: byId,
  update: decorate(update, {transactional: {}})
}
