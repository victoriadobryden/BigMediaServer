const sequelize = require('../models/sequelize')
const SQL = require('sql-template-strings')

function parseDateAsDate (date, addDays) {
  if (!date) return null
  const resDate = addDays ? new Date(addDays * 24 * 60 * 60000 + (+new Date(date))) : date
  return resDate
}

function parseDateAsStr (date, addDays) {
  const d = parseDateAsDate(date, addDays)
  return d && d.toJSON().slice(0, 10)
}

const CUSTOM_EPOCH_START = Date.UTC(2016, 0, 1)
function parseDateAsNum (date, addDays) {
  const d = parseDateAsDate(date, addDays)
  return d && (d - CUSTOM_EPOCH_START) / (24 * 60 * 60000)
}

const parseDate = parseDateAsNum

function mergePeriods (a, b) {
  if (a.length < 1 || b.length < 1) return a.concat(b)
  const VAL = 0
  const ORD = 1
  const res = []
  for (let ai = 0, bi = 0, aDatum = a[ai], bDatum = b[bi]; aDatum && bDatum;) {
    const ord = Math.min(aDatum[ORD], bDatum[ORD])
    let val
    if (aDatum[VAL] < bDatum[VAL]) {
      val = aDatum[VAL]
      aDatum = a[++ai]
    } else if (aDatum[VAL] > bDatum[VAL]) {
      val = bDatum[VAL]
      bDatum = b[++bi]
    } else {
      val = aDatum[VAL]
      aDatum = a[++ai]
      bDatum = b[++bi]
    }
    res.push([val, ord])
  }
  return res
}

function removeDuplicates (data) {
  let prevOrd = null
  return data.filter(x => {
    let res = x[1] !== prevOrd
    prevOrd = x[1]
    return res
  })
}
const SideStatus = { f: 1, t: 2, r: 3, s: 4, d: 5, n: 6 }

function process (face) {
  const periods = face.sides.length === 1
    ? face.sides[0].periods
    : face.sides.map(s => s.periods).reduce(mergePeriods)
  // face.periods = removeDuplicates(periods)
  face.periods = periods
  // face.sides = face.sides.map(s => s.id)
  delete face.sides
}

function processResults (data) {
  const out = []
  let currentFace = {}
  let currentSide = {}
  let prevEnd

  for (let {faceId, sideId, start, end, status} of data) {
    if (currentFace.id !== faceId) {
      if (currentFace.id) process(currentFace)
      currentFace = {id: faceId, sides: []}
      out.push(currentFace)
    }

    const newPeriod = [parseDate(start), status]
    if (currentSide.id !== sideId) {
      if (end && currentSide.periods) { // add last period if last end is not null
        const lastPeriod = [parseDate(prevEnd, status === SideStatus.n ? 0 : 1), SideStatus.f]
        currentSide.periods.push(lastPeriod)
      }
      currentSide = {id: sideId, periods: []}
      currentFace.sides.push(currentSide)
    } else { // same side
      // if (parseDate(prevEnd, 1) !== newPeriod[0]) console.warn('Period mismatch', prevEnd, newPeriod, 'sideId:', currentSide.id)
    }
    currentSide.periods.push(newPeriod)
    // prevPeriod = newPeriod
    prevEnd = end
  }
  return out
}

async function list ({date} = {date: new Date(2016, 4, 5)}) {
  const sql = SQL`SELECT sf.id_face [faceId], o.id_side [sideId],  date_beg [start], date_end [end], status
  FROM (
    SELECT id_side, 6 status, NULL date_beg, assembl_date date_end FROM sides
    UNION ALL
    SELECT id_side, 5 status, date_beg, date_end FROM devsdem
    UNION ALL
    SELECT id_side, 4 status, date_beg, date_end FROM proposals WHERE id_operation = 3
    UNION ALL
    SELECT id_side, 3 status, date_beg, date_end FROM proposals WHERE id_operation = 2
    UNION ALL
    SELECT id_side, 2 status, date_beg, date_end FROM proposals WHERE id_operation = 19
    UNION ALL
    SELECT id_side, 1 status, date_beg, date_end FROM freesides
  ) o
  INNER JOIN sides_face sf ON o.id_side=sf.id_side
  WHERE date_end>=${date}
  ORDER BY [faceId], [sideId], [start]`

  const results = await sequelize.query(sql)
  return processResults(results)
}

module.exports = {
  list
}
