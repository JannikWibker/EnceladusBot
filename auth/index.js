const passportJWT = require('passport-jwt')
const cache = require('memory-cache')

const auth = (public_key) => {

  const extractJWT = passportJWT.ExtractJwt
  const JWTStrategy = passportJWT.Strategy

  const jwtOptions = {
    jwtFromRequest:  extractJWT.fromAuthHeaderAsBearerToken(),
    secretOrKey: public_key
  }
  
  const strategy = new JWTStrategy(jwtOptions, (jwt_payload, cb) => {
    console.log('payload received: ', jwt_payload)
    const checkCache = !(jwt_payload.isAuthProvider !== undefined && jwt_payload.isAuthProvider === true)
    cb(null, 
      jwt_payload && (checkCache ? cache.get(jwt_payload.id) !== null : true) ? jwt_payload : false, 
      { message: cache.get(jwt_payload.id) === null ? 'token expired' : 'user not found' }
    )
  })
  
  const Login = (id, token, cb) => {
    console.log('should add ' + id + ' to cache now')
    cb(cache.put(id, token, 30 * 60 * 1000))
  }
  
  const Logout = (id, cb) => {
    cb(cache.del(id))
  }

  return {
    JWTStrategy: strategy,
    Login: Login,
    Logout: Logout
  }
}

module.exports = auth