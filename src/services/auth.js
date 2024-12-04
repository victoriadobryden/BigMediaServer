const {
  sequelize,
  User,
  Provider,
  AuthToken,
  Email,
  UserEmail,
  Permission,
  Org
} = require('../models')

const transactional = require('./decorators/transactional')
const SQL = require('sql-template-strings')

function actionsFromPermissions (permissions) {
  const result = (permissions || []).reduce((acc, it) => Object.assign(acc, {
    [it.action]: Object.assign({}, it.dataValues, {action: void 0})
  }), {})
  return result
}

function cleanUser ($) {
  return {
    id: $.id,
    login: $.login,
    orgId: $.orgId,
    name: $.name,
    firstName: $.firstName,
    lastName: $.lastName,
    tokens: $.tokens && $.tokens.map(t => ({
      id: t.id,
      profileId: t.profileId,
      displayName: t.displayName,
      pictureUrl: t.pictureUrl,
      email: t.email,
      providerId: t.providerId
    })),
    emails: $.emails,
    actions: $.actions || actionsFromPermissions($.permissions),
    org: $.org,
    cityId: $.cityId,
    regDate: $.regDate,
    address: $.address
  }
}

async function generateHash (password) {
  const [{hash}] = await sequelize.query(SQL`SELECT dbo.func_getHashedPassword(${password}) as hash`)
  return hash
}
async function isValidPassword (password, hashed) {
  return (await generateHash(password)) === hashed
}

const commonUserIncludes = [{
  model: AuthToken
}, {
  model: Email,
  attributes: {
    include: ['email']
  },
  through: { attributes: [] }
}, {
  model: Permission,
  attributes: {
    include: ['action', 'accessType'],
    exclude: ['userId', 'id']
  }
}, {
  model: Org,
  attributes: ['id', 'name', 'showPlanner', 'clientType', 'showHeatmap'],
  include: {
    model: User,
    attributes: ['id', 'firstName', 'lastName'],
    as: 'managers',
    through: {attributes: []}
  }
}]

const User$loadById = id => User.findOne({ where: {id}, include: commonUserIncludes })
const User$loadByLogin = login => User.findOne({ where: {login}, include: commonUserIncludes })
const User$loadByProfileId = async function (providerId, profileId) {
  const token = await AuthToken.findOne({ where: { providerId, profileId } })
  if (!token) return null
  return await User$loadById(token.userId)
}

const User$createFromProfile = async function (providerId, opts) {
  const {email, firstName, lastName, orgName} = opts
  const newUser = await User$register({email, firstName, lastName, orgName})
  await User$addToken(newUser, providerId, opts)
  return await User$loadById(newUser.id)
}

async function User$register ({
  login,
  password,
  firstName,
  lastName,
  email,
  orgName
}) {
  const [result] = await sequelize.query(
    SQL`
    exec sp_webuserreg
    @regname     = ${login || null},
    @pwd         = ${password ? (await generateHash(password)) : null},
    @firstname   = ${firstName || null},
    @lastname    = ${lastName || null},
    @email       = ${email || null},
    @id_city     = ${null},
    @tel         = ${null},
    @orgname     = ${orgName || null},
    @id_industry = ${null},
    @sendinfo    = ${false}
  `)
  if (!result) throw Error('user registration procedure failed')
  const userId = result.id_person
  return await User$loadById(userId)
}

async function User$addToken (user, providerId, {token, profileId, displayName, pictureUrl, email}) {
  const newToken = await AuthToken.create({
    token,
    profileId,
    displayName,
    pictureUrl,
    email,
    providerId,
    userId: user.id
  })
  user.tokens = user.tokens || []
  user.tokens.push(newToken)
  return user
}

const serializeUser = async user => cleanUser(user)
const deserializeUser = async user => user

async function localLoginLoggedInUser (user, login, password) {
  const existingUser = await localLoginReal(login, password)
  if (existingUser && existingUser.login && !user.login) {
    return await attachFacebookUserToLocal({fb: user, local: existingUser})
  }
  return user
}

async function localLoginReal (login, password) {
  const user = await User$loadByLogin(login)
  if (!user) {
    console.warn(`login: user ${login} not found`)
    return null
  }
  if (user.webDisabled === 1) {
    console.warn(`login: user ${login} is disabled for web`)
    return null
  }
  if (!(await isValidPassword(password, user.password))) {
    console.warn(`login: user ${login} suppiled invalid password`)
    return null
  }
  return cleanUser(user)
}

async function localLogin (req, login, password) {
  const res = await (req.user ? localLoginLoggedInUser(req.user, login, password)
    : localLoginReal(login, password))
  if (res && req.body.rememberme) {
    req.session.cookie.maxAge = 30 * 24 * 60 * 60000
  }
  return res
}

async function signupLoggedInUser (user, fields) {
  const {username: login, password} = fields
  // TODO: set login for local user
  const existingUser = await User$loadByLogin(login)
  if (existingUser) throw Error('400:This login already taken')
  const updateValues = {
    login,
    password: await generateHash(password)
  }
  await User.update(updateValues, {where: {id: user.id}})
  return cleanUser(Object.assign(user, updateValues))
}

async function signupNewUser (fields) {
  const login = fields.username
  const existingUser = await User$loadByLogin(login)
  if (existingUser) throw Error('400: This login already taken')
  const newUser = await User$register({
    login: fields.username,
    password: fields.password,
    email: fields.email,
    firstName: fields.firstname,
    lastName: fields.lastname,
    orgName: fields.orgname
  })
  return newUser
}

async function localSignup (req, fields) {
  if (req.user) {
    if (!req.user.login) {
      req.user = await signupLoggedInUser(req.user, fields)
    }
  } else {
    req.user = await signupNewUser(fields)
  }
  return req.user
}

async function facebookUpdateToken (user, accessToken, refreshToken, profile) {
  const providerId = Provider.facebook
  if (user.webDisabled === 1) {
    console.warn(`login via provider ${providerId}: user ${profile.id} is disabled for web`)
    return null
  }
  // if there is a user id already but no token (user was linked at one point and then removed)
  const updateFields = {
    token: accessToken,
    profileId: profile.id,
    displayName: (profile.name.givenName || '') + ' ' + (profile.name.familyName || ''),
    pictureUrl: profile.photos[0].value || '',
    email: (profile.emails[0].value || '').toLowerCase()
  }

  const existingToken = user.tokens.find(t => t.providerId === providerId)
  if (!existingToken) {
    await User$addToken(user, providerId, updateFields)
  } else if (existingToken !== accessToken) {
    await existingToken.update(updateFields)
    Object.assign(existingToken, updateFields)
  }
  return cleanUser(user)
}

async function facebookCreateUser (accessToken, refreshToken, profile) {
  const providerId = Provider.facebook

  const newUser = await User$createFromProfile(providerId, {
    token: accessToken,
    profileId: profile.id,
    firstName: profile.name.givenName,
    lastName: profile.name.familyName,
    orgName: `COMPANY ${profile.name.givenName || ''} ${profile.name.familyName || ''}`,
    displayName: `${profile.name.givenName || ''} ${profile.name.familyName || ''}`,
    pictureUrl: profile.photos[0].value || '',
    email: (profile.emails[0].value || '').toLowerCase()
  })
  return cleanUser(newUser)
}

async function attachFacebookUserToLocal ({fb, local}) {
  console.warn('attaching fb user:', fb.id, 'to local:', local.id)
  // 1. move all tokens from fb user to local
  // TODO: possible conflict here, unique key violation
  await AuthToken.update({userId: local.id}, {where: {userId: fb.id}})
  // 2. change campain org to local user org
  // await Campaign.update({clientId: local.orgId}, {where: {clientId: fb.orgId}})
  await sequelize.query(`UPDATE adv_camps SET id_client = ${local.orgId} WHERE id_client=${fb.orgId}`)
  // 3. delete facebook org and user
  // await User.destroy({where: {id: fb.id}})
  // await Org.destroy({where: {id: fb.orgId}})
  return await User$loadById(local.id)
}

async function facebookLoginLoggedInUser (user, accessToken, refreshToken, profile) {
  const providerId = Provider.facebook
  const existingUser = await User$loadByProfileId(providerId, profile.id)
  if (!existingUser) {
    if (!user.login) return cleanUser(user) // login from another facebook user, ignore this
    // 'user' is local user, add facebook token
    return await User$addToken(user, providerId, {
      token: accessToken,
      profileId: profile.id,
      displayName: `${profile.name.givenName || ''} ${profile.name.familyName || ''}`,
      pictureUrl: profile.photos[0].value || '',
      email: (profile.emails[0].value || '').toLowerCase()
    })
  }
  // we have existing user
  if (existingUser.id === user.id) return await facebookUpdateToken(user, accessToken, refreshToken, profile)
  // we have existing user, and it differs from the logged in user
  if (user.login && !existingUser.login) return await attachFacebookUserToLocal({fb: existingUser, local: user})
  return user
}

async function facebookLoginReal (req, accessToken, refreshToken, profile) {
  const providerId = Provider.facebook
  const user = await User$loadByProfileId(providerId, profile.id)
  if (user) return await facebookUpdateToken(user, accessToken, refreshToken, profile)
  return await facebookCreateUser(accessToken, refreshToken, profile)
}

async function facebookLogin (req, accessToken, refreshToken, profile) {
  if (req.user) return await facebookLoginLoggedInUser(req.user, accessToken, refreshToken, profile)
  return await facebookLoginReal(req, accessToken, refreshToken, profile)
}

async function facebookRemoveToken (user) {
  const providerId = Provider.facebook
  const userId = user.id
  user.tokens = user.tokens.filter(t => t.providerId !== providerId)
  return await AuthToken.destroyOne({where: {providerId, userId}})
}

async function updateProfileInfo (user, props) {
  const {cityId, firstName, lastName, address} = props
  const {id} = user
  const userNewData = {cityId, firstName, lastName, address}
  const updateCount = await User.updateOne(userNewData, {where: {id}})
  Object.assign(user, userNewData)
  if (updateCount !== 1) throw Error(404) // how is this possible at all???
  return cleanUser(await User$loadById(id))
}

async function updatePassword (user, {password}) {
  const {id} = user
  const hash = await generateHash(password)
  await User.updateOne({password: hash}, {where: {id}})
  return user
}

const locales = require('../lib/locales')
const transporter = require('../lib/mail')

async function sendPasswordResetEmail ({email, locale, authCode, name}) {
  const sendMail = transporter.templateSender(locales.resetPasswordEmail[locale], {
    from: '"Bigmedia" <noreply@bigmedia.ua>',
    attachments: locales.attachments
  })
  sendMail({ to: email }, { authCode, name}, function (err, res) {
    if (err) console.error('Error sending email', err)
  })
}

// const crypto = require('crypto')
const Redis = require('ioredis')
const config = require('../config')
const generatePassword = require('password-generator')

async function askForPasswordReset (props) {
  const {email, locale} = props
  if (!email) throw Error(`400: email must be specified`)
  if (!locale) throw Error('400: locale must be specified')
  const emailInDb = await Email.findOne({
    where: {email},
    attributes: [],
    include: {
      model: UserEmail,
      attribures: ['userId'],
      required: true,
      include: {
        model: User,
        attributes: ['id', 'name']
      }
    },
    raw: true,
    nest: true
  })
  console.info(emailInDb)
  if (!emailInDb) throw Error(`400: email doesn't exit`)
  const user = emailInDb.userEmail.user
  console.info(user)
  if (!user) throw Error(`400: user doesn't exist`)
  if (user.webDisabled === 1) throw Error(`400: user is disabled for web`)

  const redis = new Redis(config.get('REDIS'))
  const toSave = { email, userId: user.id }
  let id, key, updated
  try {
    do {
      id = generatePassword() // crypto.randomBytes(10).toString('hex')
      key = `reset-password:${id}`
      updated = await redis.setnx(key, JSON.stringify(toSave))
      console.log(key, updated)
    } while (updated !== 1)
    redis.expire(key, 30 * 60)
  } finally {
    redis.disconnect()
  }
  await sendPasswordResetEmail({email, locale, authCode: id, name: user.name})
  return id
}

async function performPasswordReset (id) {
  const redis = new Redis(config.get('REDIS'))
  let resetRequest
  try {
    const key = `reset-password:${id}`
    resetRequest = await redis.get(key)
    await redis.del(key) // TODO: maybe leave it?
  } finally {
    redis.disconnect()
  }
  if (!resetRequest) throw Error(404)
  const {userId} = JSON.parse(resetRequest)
  console.log('email login user:', userId)
  const user = await User$loadById(userId)
  if (!user) throw Error(`400: user doesn't exist`)
  if (user.webDisabled === 1) throw Error(`400: user is disabled for web`)
  return user
}

module.exports = {
  serializeUser,
  deserializeUser,
  localLogin: transactional(localLogin),
  facebookLogin: transactional(facebookLogin),
  facebookRemoveToken: transactional(facebookRemoveToken),
  localSignup: transactional(localSignup),
  updateProfileInfo: transactional(updateProfileInfo),
  updatePassword: transactional(updatePassword),
  askForPasswordReset,
  performPasswordReset: transactional(performPasswordReset)
}
