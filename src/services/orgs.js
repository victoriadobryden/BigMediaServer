const {Org, OrgLogo} = require('../models')
const {decorate} = require('./decorators')

async function list () {
  return await Org.rls().findAll()
}

async function byId (id) {
  return await Org.rls().findOne({ where: {id} })
}

async function create ({name}) {
  const {id} = await Org.create({name})
  return {id}
}

async function replace (id, props) {
  const {name, orgLogo: {logo}} = props
  let res = 0
  if (name !== undefined) {
    const orgUpdateCount = await Org.rls().updateOne({name}, {where: {id}})
    if (orgUpdateCount === 0) return res
  }
  if (logo !== undefined) {
    const checkCompanyAccess = await Org.rls().findOne({where: {id}, raw: true})
    if (!checkCompanyAccess) throw Error(404)
    await OrgLogo.destroy({where: {orgId: id}})
    await OrgLogo.create({orgId: id, logo})
    res = 1
  }
  return res
}

async function remove (id) {
  return await Org.rls().destroyOne({where: {id}})
}

const logo = async (orgId) => {
  const orgLogo = await OrgLogo.rls().findOne({
    where: { orgId }
  })
  return orgLogo && orgLogo.logo
}

module.exports = {
  list: decorate(list, {permissions: {showOrgs: 1}}),
  byId: byId,
  logo: logo,
  create: decorate(create, {permissions: {showOrgs: 2}, transactional: {}}),
  replace: decorate(replace, {transactional: {}}),
  remove: decorate(remove, {permissions: {showOrgs: 2}, transactional: {}})
}
