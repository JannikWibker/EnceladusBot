const auth = require('./auth/index.js')
const fetch = require('node-fetch')
const RSA = require('node-rsa')

const rsa = new RSA()

const fetchRegister = (accounts_url, secret, public_key, { name, id, url, app }) => {

  const payload = {
    name: name,
    id: id,
    url: url,
    app: app
  }

  const timestamp = +new Date()

  rsa.importKey(public_key)

  return fetch(accounts_url + '/register', {
    method: 'POST',
    body: JSON.stringify({
      data: payload,
      timestamp: timestamp
    }),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + Buffer.from(rsa.encrypt(JSON.stringify({ ...payload, timestamp: timestamp, secret: secret })), 'binary').toString('base64')
    }
  })
  .then(res => res.json())
}


const init = (secret, accounts_url, known_service=false, retry_on_fail=false, {name, id, url, app}, retry_time=60, cb) => {
  fetch(accounts_url + '/public_key')
    .then(res => res.text())
    .then(public_key => {

      console.log('[accounts/registration] public key retrieval successful')

      if(known_service) {
        return {
          message: 'known service',
          public_key: public_key
        }
      } else {
        return fetchRegister(accounts_url, secret, public_key, { name, id, url, app })
      }
    })
    .then(json => {
      if(json.message === 'already registered') console.log('[accounts/registration] Registration unneccessary, set KNOWN_SERVICE to true')
      if(json.message === 'registration successful') console.log('[accounts/registration] Registration successful')
      if(json.message === 'registration failed') console.log('[accounts/registration] Registration failed')

      return json
    })
    .then(json => {
      const { JWTStrategy, Login, Logout } = auth(json.public_key)

      const login = (req, res) => {
        if(req.body.id !== undefined) {
          console.log('should add ' + req.body.id + ' to cache now')
          Login(req.user.id, req.get('Authorization').substr('Bearer '.length), () => res.json({ message: 'login successful' }))
        } else {
          console.log('expected req.body.id to be the id')
          res.status(401).json({ message: 'expected req.body.id to be the id' })
        }
      }

      const logout = (req, res) => {
        if(req.body.id !== undefined) {
          console.log('should remove ' + req.body.id + ' from cache now')
          Logout(req.user.id, bool => res.json({ message: bool ? 'log out successful' : 'log out failed' }))
        } else {
          console.log('expected req.body.id to be the id')
          res.status(401).json({ message: 'expected req.body.id to be the id' })
        }
      }

      cb({ JWTStrategy, Login, login, Logout, logout })


    })
    .catch((err) => {
      console.log('[accounts/registration] error: ' + err.message)
      if(retry_on_fail && retry_time === 0) {
        console.log('[accounts/registration] public key retrieval failed, server not online. Not retrying since retry_time = 0')
      } else if(retry_on_fail && retry_time < 60*16+1) {
        console.log('[accounts/registration] public key retrieval failed, server not online. Retrying in ' + retry_time + ' seconds.')
        setTimeout(() => init(secret, accounts_url, known_service, retry_on_fail, {name, id, url, app}, retry_time*2, cb), retry_time * 1000)
      } else if(retry_on_fail) {
        console.log('[accounts/registration] public key retrieval failed, server not online. Not retrying anymore.')
      } else {
        console.log('[accounts/registration] public key retrieval failed, server not online. Set RETRY_ON_FAIL to true, to automatically retry')
      }
    })
}

module.exports = init