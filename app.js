const express = require('express')
const app = express()
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
app.use(express.json())

let dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null
let dbConnection = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server running on port http://localhost:3000/')
    })
  } catch (e) {
    console.log(`Error occured: ${e.message}`)
    process.exit(1)
  }
}
dbConnection()

let stateConvert = eachItem => {
  return {
    stateId: eachItem.state_id,
    stateName: eachItem.state_name,
    population: eachItem.population,
  }
}
let districtConvert = eachItem => {
  return {
    districtId: eachItem.district_id,
    districtName: eachItem.district_name,
    stateId: eachItem.state_id,
    cases: eachItem.cases,
    cured: eachItem.cured,
    active: eachItem.active,
    deaths: eachItem.deaths,
  }
}

function tokenHandler(request, response, next) {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'asdf', async (error, payload) => {
      if (error) {
        response.send('Invalid JWT Token')
      } else {
        // response.send('Token valid')
        next()
      }
    })
  }
}

//User API
app.post('/login/', async (request, response) => {
  let {username, password} = request.body
  let query = `select * from user where username = '${username}';`
  let queryResult = await db.get(query)
  if (queryResult === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    let passwordHash = await bcrypt.compare(password, queryResult.password)
    if (passwordHash === true) {
      let payload = {
        username: username,
      }
      let jwtToken = await jwt.sign(payload, 'asdf')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', tokenHandler, async (request, response) => {
  let query = `select * from state;`
  let queryResult = await db.all(query)
  response.send(queryResult.map(eachItem => stateConvert(eachItem)))
})

app.get('/states/:stateId/', tokenHandler, async (request, response) => {
  let {stateId} = request.params
  let query = `select * from state where state_id = ${stateId};`
  let queryResult = await db.get(query)
  response.send(stateConvert(queryResult))
})

app.post('/districts/', async (request, response) => {
  let {districtId, districtName, stateId, cases, cured, active, deaths} =
    request.body
  let query = `insert into district (district_name,state_id,cases, cured,active,deaths) 
  values ("${districtName}",${stateId},${cases},${cured},${active},${deaths});`
  let queryResult = await db.run(query)
  response.send('District Successfully Added')
})

app.get('/districts/:districtId/', tokenHandler, async (request, response) => {
  let {districtId} = request.params
  let query = `select * from district where district_id = ${districtId};`
  let queryResult = await db.get(query)
  response.send(districtConvert(queryResult))
})

app.delete(
  '/districts/:districtId/',
  tokenHandler,
  async (request, response) => {
    let {districtId} = request.params
    let query = `delete from district where district_id = ${districtId};`
    await db.run(query)
    response.send('District Removed')
  },
)

app.put('/districts/:districtId/', async (request, response) => {
  let {districtId} = request.params
  let {districtName, stateId, cases, cured, active, deaths} = request.body
  let query = `UPDATE district SET 
  district_name = "${districtName}", 
  state_id = ${stateId}, 
  cases = ${cases}, 
  cured = ${cured}, 
  active = ${active}, 
  deaths = ${deaths}
  WHERE district_id = ${districtId};`

  await db.run(query)
  response.send('District Details Updated')
})

app.get('/states/:stateId/stats/', tokenHandler, async (request, response) => {
  let {stateId} = request.params
  let query = `select sum(cases) as totalCases,
  sum(cured) as totalCured,
  sum(active) as totalActive,
  sum(deaths) as totalDeaths
  from district where state_id = ${stateId} 
  ;`
  let queryResult = await db.get(query)
  response.send(queryResult)
})

module.exports = app
