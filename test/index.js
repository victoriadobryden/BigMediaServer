const test = require('ava')
const http = require('http')
const request = require('request-promise').defaults({
  resolveWithFullResponse: true
})
const diff = require('difflet')({ indent: 2 })
const app = require('../src/app')

const API_NS = '/api/v1'

async function listen ({ns = API_NS} = {}) {
  const srv = http.createServer(app)
  return new Promise((resolve, reject) => {
    srv.listen(err => {
      if (err) return reject(err)
      const {port} = srv.address()
      resolve(`http://localhost:${port}${ns}`)
    })
  })
}

async function getTestUserToken (profileId = '117323858753290') {
  const APP_ID = '1308134669200550'
  const APP_SECRET = 'aa06639f6d0d9edec7172d5e8ea80c1b'
  const APP_TOKEN = `${APP_ID}|${APP_SECRET}`
  const fbTestUsersURL = `https://graph.facebook.com/v2.8/${APP_ID}/accounts/test-users?access_token=${APP_TOKEN}`
  const resp = await request(fbTestUsersURL, {json: true})
  return resp.body.data.filter(u => u.id === profileId)[0].access_token
}


test.skip('/ should serve html SPA', async t => {
  t.plan(2)
  const url = await listen()
  const resp = await request(url)
  t.is(resp.statusCode, 200)
  t.truthy(resp.body.startsWith('<!DOCTYPE HTML>'))
})

test('/auth/local/login', async t => {
  const url = await listen()
  const loginUrl = `${url}/auth/local/login`

  try {
    await request.post(loginUrl, {form: {username: 'dummylogin', password: 'notexist'}})
    t.fail('incorrect login/pasword should not pass')
  } catch (e) {
    t.is(e.statusCode, 401, 'incorrect login shoud respond with 401')
  }

  try {
    const resp = await request.post(loginUrl, {form: {username: 'ntk', password: 'eDuhsrF8'}})
    t.is(resp.statusCode, 200, 'correct login should respond with 200')
    const user = JSON.parse(resp.body)
    const expected = {
      id: 6319,
      login: 'ntk',
      orgId: 5146,
      name: 'Анфиса Коленко',
      firstName: 'Анфиса',
      lastName: 'Коленко',
      tokens: [],
      emails: [{id: 7771, email: 'anfisa_kl@list.ru'}],
      actions: {
        '4': {accessType: 2},
        '5': {accessType: 2},
        '9': {accessType: 2},
        '10': {accessType: 2},
        '11': {accessType: 1},
        '15': {accessType: 2}
      },
      org: {id: 5146, name: 'Master AD Ukraine (Posterscope Ukraine)', showPlanner: 1},
      cityId: 1,
      regDate: '2016-09-08T11:46:19.270Z',
      address: null
    }
    const managers = user.org.managers
    delete user.org.managers
    t.deepEqual(user, expected, diff.compare(user, expected))
    t.is(managers.length, 15)
  } catch (e) {
    t.fail(`local login throws: ${e}`)
  }
})

test('/auth/facebook-token', async t => {
  const url = await listen()
  const loginUrl = `${url}/auth/facebook-token`

  const token = await getTestUserToken()
  const resp = await request.post(loginUrl, { form: { access_token: token } })
  t.is(resp.statusCode, 200)
  const user = JSON.parse(resp.body)
  const expected = {
    id: 6404,
    login: null,
    orgId: 16426,
    name: 'Richard Romansky',
    firstName: 'Richard',
    lastName: 'Romansky',
    tokens:
    [ { id: 25,
      profileId: '117323858753290',
      displayName: 'Richard Romansky',
      pictureUrl: 'https://graph.facebook.com/v2.6/117323858753290/picture?type=large',
      email: '',
      providerId: 1} ],
    emails: [],
    actions: {
      '4': { accessType: 2 },
      '5': { accessType: 2 },
      '9': { accessType: 2 },
      '10': { accessType: 2 },
      '11': { accessType: 1 },
      '15': { accessType: 2 }
    },
    org: {id: 16426, name: 'COMPANY Richard Romansky', managers: [], showPlanner: null},
    cityId: null,
    regDate: '2016-11-24T17:33:40.523Z',
    address: null
  }
  t.deepEqual(user, expected, diff.compare(user, expected))
})

async function loginTestUser (url) {
  const jar = request.jar()
  const user = await request.post(`${url}/auth/local/login`, {form: {username: 'ntk', password: 'eDuhsrF8'}, jar, json: true})
  console.log(user.body)
  return jar
}

test('/campaigns', async t => {
  const url = await listen()
  const jar = await loginTestUser(url)
  const resp = await request(`${url}/campaigns/?fromDate=2016-10-01T00:00:00Z`, {jar, json: true})
  t.is(resp.statusCode, 200)
  const campaigns = resp.body
  console.log(campaigns)
  t.truthy(campaigns.length > 50)
  t.truthy('subjectId' in campaigns[0])
})

test('/campaigns/:id', async t => {
  const url = await listen()
  const jar = await loginTestUser(url)
  const id = 66980
  const campaign = await request(`${url}/campaigns/${id}`, {jar, json: true})
  t.is(campaign.statusCode, 200)
  // console.log(campaign.body)
  // t.truthy(campaign.body.length > 60)
})

test('/campaigns/:id/proposals', async t => {
  const url = await listen()
  const jar = await loginTestUser(url)
  const campaignId = 66980
  const res = await request(`${url}/campaigns/${campaignId}/proposals/`, {jar, json: true})
  t.is(res.statusCode, 200)
  const proposals = res.body
  // console.log(proposals)
  t.is(proposals.length, 4)
})

test('/campaigns/:id/documents', async t => {
  const url = await listen()
  const jar = await loginTestUser(url)
  const campaignId = 66980
  const res = await request(`${url}/campaigns/${campaignId}/documents/`, {jar, json: true})
  t.is(res.statusCode, 200)
  const documents = res.body
  // console.log(documents)
  t.is(documents.length, 43)
})

test('/campaigns/:id/posters', async t => {
  const url = await listen()
  const jar = await loginTestUser(url)
  const campaignId = 66980
  const res = await request(`${url}/campaigns/${campaignId}/posters/`, {jar, json: true})
  t.is(res.statusCode, 200)
  const posters = res.body
  // console.log(posters)
  t.is(posters.length, 6)
})

test('/campaigns/:id/photos', async t => {
  const url = await listen()
  const jar = await loginTestUser(url)
  const campaignId = 66980
  const res = await request(`${url}/campaigns/${campaignId}/photos/`, {jar, json: true})
  t.is(res.statusCode, 200)
  const photos = res.body
  // console.log(JSON.stringify(photos, null, 2))
  t.is(photos.length, 53)
})

test.skip('/campaigns/:id/photorecs.zip', async t => {
  const url = await listen()
  const jar = await loginTestUser(url)
  const campaignId = 66980
  const res = request(`${url}/campaigns/${campaignId}/photorecs.zip`, {jar})
  const out = require('fs').createWriteStream('/tmp/out.zip')
  res.pipe(out)
  res.on('response', function (resp) {
    t.is(resp.statusCode, 200)
    t.is(resp.headers['content-type'], 'application/zip')
  })
  await res
  console.log('done')
})

test('/campaigns/:id/serviceOperations', async t => {
  const url = await listen()
  const jar = await loginTestUser(url)
  const campaignId = 66980
  const res = await request(`${url}/campaigns/${campaignId}/serviceOperations/`, {jar, json: true})
  t.is(res.statusCode, 200)
  const serviceOperations = res.body
  // console.log(JSON.stringify(serviceOperations, null, 2))
  t.is(serviceOperations.length, 9)
})

test('/campaigns/:id/estimations', async t => {
  const url = await listen()
  const jar = await loginTestUser(url)
  const campaignId = 71338
  const res = await request(`${url}/campaigns/${campaignId}/estimations/`, {jar, json: true})
  t.is(res.statusCode, 200)
  const estimations = res.body
  // console.log(JSON.stringify(estimations, null, 2))
  t.is(estimations.length, 14)
})

test('/sides', async t => {
  const url = await listen()
  const res = await request(`${url}/sides/`, {json: true})
  t.is(res.statusCode, 200)
  const sides = res.body
  console.log(sides.slice(0, 10))
  t.truthy(sides.length > 10000)
})

test('/faces', async t => {
  const url = await listen()
  const res = await request(`${url}/faces/`, {json: true})
  t.is(res.statusCode, 200)
  const faces = res.body
  // console.log('faces.length', faces.length)
  // console.log(JSON.stringify(faces.slice(0, 10), null, 2))
  t.truthy(faces.length > 10000)
})

test('/occupancy', async t => {
  const url = await listen()
  const res = await request(`${url}/occupancy/`, {json: true})
  t.is(res.statusCode, 200)
  // const occupancy = res.body
  // console.log(occupancy.length)
  // console.log(JSON.stringify(occupancy.slice(0, 10), null, 2))
})

test('POST /campaigns', async t => {
  const url = await listen()
  const jar = await loginTestUser(url)
  const res = await request.post(`${url}/campaigns/`, {
    jar,
    json: {
      name: 'Test campaign',
      startDate: new Date(),
      endDate: new Date((+new Date()) + 24 * 60 * 6000)
    }
  })
  t.is(res.statusCode, 201)
  const created = res.body
  t.is(res.headers['location'], `${API_NS}/campaigns/${created.id}`)
  do {
    const res = await request.put(`${url}/campaigns/${created.id}`, {
      jar,
      json: {
        name: 'Updated Test Campaign',
        managerId: 1,
        startDate: new Date(),
        endDate: new Date((+new Date()) + 24 * 60 * 6000)
      }
    })
    t.is(res.statusCode, 200)
    t.is(res.body.updated, 1)
  } while (0)

  do {
    const res = await request.del(`${url}/campaigns/${created.id}`, {jar, json: true})
    t.is(res.statusCode, 200)
    t.is(res.body.deleted, 1)
  } while (0)
})

test('POST /campaigns/:id/proposals', async t => {
  const url = await listen()
  const jar = await loginTestUser(url)
  const {body: newCampaign} = await request.post(`${url}/campaigns/`, {
    jar,
    json: {
      name: 'Test campaign for proposals',
      startDate: new Date(),
      endDate: new Date((+new Date()) + 24 * 60 * 6000)
    }
  })
  try {
    const res = await request.post(`${url}/campaigns/${newCampaign.id}/proposals`, {
      jar,
      json: {
        faceId: 100,
        operationId: 1,
        startDate: '2017-04-01T00:00:00.000Z',
        endDate: '2017-04-30T00:00:00.000Z'
      }
    })
    t.is(res.statusCode, 201)
    const created = res.body
    t.is(res.headers['location'], `${API_NS}/campaigns/${newCampaign.id}/proposals/${created.id}`)
    do {
      const res = await request.put(`${url}/campaigns/${newCampaign.id}/proposals/${created.id}`, {
        jar,
        json: {
          endDate: new Date(2044, 3, 3)
        }
      })
      t.is(res.statusCode, 200)
      t.is(res.body.updated, 1)
    } while (0)
    do {
      const res = await request.del(`${url}/campaigns/${newCampaign.id}/proposals/${created.id}`, {jar, json: true})
      t.is(res.statusCode, 200)
      t.is(res.body.deleted, 1)
    } while (0)
  } finally {
    await request.del(`${url}/campaigns/${newCampaign.id}`, {jar, json: true})
  }
})

test('POST /proposals', async t => {
  const url = await listen()
  const jar = await loginTestUser(url)
  const {body: newCampaign} = await request.post(`${url}/campaigns/`, {
    jar,
    json: {
      name: 'Test campaign for proposals',
      startDate: new Date(),
      endDate: new Date((+new Date()) + 24 * 60 * 6000)
    }
  })
  try {
    const res = await request.post(`${url}/proposals`, {
      jar,
      json: {
        campaignId: newCampaign.id,
        faceId: 100,
        operationId: 1,
        startDate: '2017-04-01T00:00:00.000Z',
        endDate: '2017-04-30T00:00:00.000Z'
      }
    })
    t.is(res.statusCode, 201)
    const created = res.body
    t.is(res.headers['location'], `${API_NS}/proposals/${created.id}`)
    do {
      const res = await request.put(`${url}/proposals/${created.id}`, {
        jar,
        json: {
          endDate: new Date(2044, 3, 3)
        }
      })
      t.is(res.statusCode, 200)
      t.is(res.body.updated, 1)
    } while (0)
    do {
      const res = await request.del(`${url}/campaigns/${newCampaign.id}/proposals/${created.id}`, {jar, json: true})
      t.is(res.statusCode, 200)
      t.is(res.body.deleted, 1)
    } while (0)
  } finally {
    await request.del(`${url}/campaigns/${newCampaign.id}`, {jar, json: true})
  }
})

test('POST /proposals with faceId', async t => {
  const url = await listen()
  const jar = await loginTestUser(url)
  const {body: newCampaign} = await request.post(`${url}/campaigns/`, {
    jar,
    json: {
      name: 'Test campaign for proposals',
      startDate: new Date(),
      endDate: new Date((+new Date()) + 24 * 60 * 6000)
    }
  })
  try {
    const res = await request.post(`${url}/proposals`, {
      jar,
      json: {
        campaignId: newCampaign.id,
        faceId: 100,
        operationId: 1,
        startDate: new Date(),
        endDate: new Date((+new Date()) + 24 * 60 * 6000)
      }
    })
    t.is(res.statusCode, 201)
    const created = res.body
    t.is(res.headers['location'], `${API_NS}/proposals/${created.id}`)
    const createdLoaded = await request.get(`${url}/proposals/${created.id}`, {jar, json: true})
    do {
      const res = await request.put(`${url}/proposals/${created.id}`, {
        jar,
        json: {
          endDate: new Date(2044, 3, 3)
        }
      })
      t.is(res.statusCode, 200)
      t.is(res.body.updated, 1)
    } while (0)
    do {
      const res = await request.del(`${url}/campaigns/${newCampaign.id}/proposals/${created.id}`, {jar, json: true})
      t.is(res.statusCode, 200)
      t.is(res.body.deleted, 1)
    } while (0)
  } finally {
    await request.del(`${url}/campaigns/${newCampaign.id}`, {jar, json: true})
  }
})

test('/auth/user/emails', async t => {
  const url = await listen()
  const jar = await loginTestUser(url)
  const base = `/auth/user/emails`
  let res = await request.get(`${url}${base}`, {jar, json: true})
  const {body: emails} = res
  t.is(emails.length, 1)
  res = await request.post(`${url}${base}`, {
    jar,
    json: {
      email: 'test@email.com'
    }})
  const {body: created} = res
  t.is(res.headers['location'], `${API_NS}${base}/${created.id}`)
  res = await request.put(`${url}${base}/${created.id}`, {jar, json: {email: 'updated@email'}})
  const {body: updated} = await request.get(`${url}${base}`, {jar, json: true})
  t.is(updated.length, 2)
  t.is(updated.some(({email}) => email === 'updated@email'), true)
  res = await request.delete(`${url}${base}/${created.id}`, {jar, json: true})
  const {body: deleted} = res
})

test('PUT /auth/user', async t => {
  const url = await listen()
  const jar = await loginTestUser(url)
  const res = await request.put(`${url}/auth/user`, {
    jar,
    json: {
      firstName: 'Алиса',
      lastName: 'Коленко',
      address: null
    }})
  t.is(res.body.firstName, 'Алиса')
  const res2 = await request.put(`${url}/auth/user`, {
    jar,
    json: {
      firstName: 'Анфиса',
      lastName: 'Коленко',
      address: null
    }})
  t.is(res2.body.firstName, 'Анфиса')
})

test('GET /published/campaigns/:id', async t => {
  const secretId = 'AD0C9029-0E46-4F2D-8F79-525E8A3C14CB'
  const url = await listen()
  const res = await request.get(`${url}/published/campaigns/${secretId}`, {json: true})
  t.is(res.statusCode, 200)
  const campaign = res.body
  console.log(campaign)
})

test('GET /orgs/:id', async t => {
  const url = await listen()
  const orgId = 5146
  const jar = await loginTestUser(url)
  const res = await request.get(`${url}/orgs/${orgId}`, {json: true, jar})
  t.is(res.statusCode, 200)
  const org = res.body
  console.log(org)
})

test('GET /orgs/:id/logo.png', async t => {
  const url = await listen()
  const orgId = 5146
  const jar = await loginTestUser(url)
  const res = await request.get(`${url}/orgs/${orgId}/logo.png`, {jar})
  t.is(res.statusCode, 200)
  const logo = res.body
  console.log(logo)
})

test('POST /campaigns/:id/published', async t => {
  const url = await listen()
  const jar = await loginTestUser(url)
  const {body: newCampaign} = await request.post(`${url}/campaigns/`, {
    jar,
    json: {
      name: 'Test campaign for proposals',
      startDate: new Date(),
      endDate: new Date((+new Date()) + 24 * 60 * 6000)
    }
  })
  try {
    const res = await request.post(`${url}/campaigns/${newCampaign.id}/published`, {
      jar,
      json: {
        name: 'test published campaign',
        startDate: '2017-04-01T00:00:00.000Z',
        endDate: '2017-04-30T00:00:00.000Z',
        email: 'test@published.campaign'
      }
    })
    t.is(res.statusCode, 201)
    const created = res.body
    t.is(res.headers['location'], `${API_NS}/campaigns/${newCampaign.id}/published/${created.id}`)
    do {
      const res = await request.put(`${url}/campaigns/${newCampaign.id}/published/${created.id}`, {
        jar,
        json: {
          name: 'test published campaign update',
          startDate: '2017-04-01T00:00:00.000Z',
          endDate: new Date(2044, 3, 3)
        }
      })
      t.is(res.statusCode, 200)
      t.is(res.body.updated, 1)
    } while (0)
    do {
      const res = await request.del(`${url}/campaigns/${newCampaign.id}/published/${created.id}`, {jar, json: true})
      t.is(res.statusCode, 200)
    } while (0)
  } finally {
    await request.del(`${url}/campaigns/${newCampaign.id}`, {jar, json: true})
  }
})

// USERNAME=test$RANDOM$RANDOM
// curl -v --data "username=$USERNAME&password=11111&orgname=org_$USERNAME&email=${USERNAME}@some.test" http://localhost:3000/auth/local/signup
