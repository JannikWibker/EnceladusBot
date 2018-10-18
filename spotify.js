const spotify_auth = (spotify, tokenObject) =>  new Promise((resolve, reject) => {
  if(tokenObject.spotify_access_token) {
    spotify.setRefreshToken(tokenObject.spotify_refresh_token)
    if(tokenObject.spotify_expire_time > Date.now()) {
      spotify.setAccessToken(tokenObject.spotify_access_token)
        resolve(spotify)
    } else {
      spotify.refreshAccessToken()
        .then(() => resolve(spotify))
    }
  } else {
    reject()
  }
})

module.exports = {
  spotify_auth
}