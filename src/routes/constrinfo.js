const express = require('express')
const {sequelize} = require('../models')

const {asyncMW} = require('../utils/async')

const router = express.Router()

router.get('/:id', asyncMW(async (req, res) => {
  const constrId = req.params.id
  if (!constrId) {
    throw Error('wrong query for constrinfo')
  }
  const [result] = await sequelize.query(`
      exec sp_web_constrinfo
      @id_constr  = :constrId
    `, { replacements: {
        constrId: constrId
    }, type: sequelize.QueryTypes.SELECT })
  if (!result) throw Error('get constrinfo failed')
  res.status(201)
  res.json(result)
}))

module.exports = router
