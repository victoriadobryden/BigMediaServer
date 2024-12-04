const {FinDocument, ViewLinkDocumentCampaign, FinDocumentFile, ViewDocumentCommon} = require('../../models')

async function list (campaignId) {
  const documents = await FinDocument.rls().findAll({
    include: [{
      model: ViewLinkDocumentCampaign,
      where: {campaignId},
      attributes: [],
      required: true
    }, {
      model: FinDocumentFile,
      attributes: ['id'],
      as: 'pdf'
    }, {
      model: ViewDocumentCommon,
      attributes: ['num', 'date', 'addendumType'],
      as: 'common'
    }]
  })
  return documents
}

const FileTypes = {
  rtf: 343,
  xls: 344,
  pdf: 345
}

async function fileByType (documentId, filetypeStr) {
  const filetype = FileTypes[filetypeStr.toLowerCase()]
  if (!filetype) throw Error(`400 Invalid file type ${filetypeStr}`)
  const file = await FinDocumentFile.findOne({
    where: {documentId, filetype},
    attributes: ['filename', 'blob']
  })
  return file
}

const create = _ => _
const update = _ => _
const remove = _ => _

module.exports = {
  list,
  create,
  update,
  remove,
  fileByType
}

