<script context="module">

  import Server from "./server.js"
  import DataStorage from "./session.js"

  import {
    WIDGETTYPES,
    COLORMODES,
    widgetType,
    tournamentTime,
    leaderBoard,
    leaderBoardStructure,
    player,
    playerStructure,
    gamesCarousel,
    gamesCarouselStructure,
  } from "../stores/store.js"
  
  import { urlAPI, urlConfiguration, appUser } from "../stores/setup.js"

  const urlAuth = "https://localhost:5001/user/authenticate"
  let authData = null
  
  Array.prototype.first = function () {
    return this[0]
  }
  Date.prototype.addDays = function (days) {
    var date = new Date(this.valueOf())
    date.setDate(date.getDate() + days)
    return date
  }

  // LOAD QUERY DATA
  const loadQueryData = (callback) => {
    console.log("Load Query Data...")

    // EXTRA: SAVE WIDGET TYPE PARAMETER
    // widgetType.set(appConfigStructure.tournamentType)

    // SAVE APP PARAMETERS
    // appConfig.set(appConfigStructure)

    if (callback) callback()
  }

  // LOAD SERVER AUTH
  /* const loadServerAuth = (data, callback) => {
    console.log("Load Server Auth...")
    Server.fetchPost(urlAuth, data, null, (value) => {
      console.log("Auth.")
      if (callback) callback(value)
    })
  } */

  // LOAD SERVER DATA
  const loadUserAuth = (callback) => {

    authData = DataStorage.permanentGet("auth", () => {
      Server.fetchPost(urlAuth, { username: "test", password: "test" }, null, (value) => {

        if (value.id != null) {
          DataStorage.permanentSet(
            "auth", 
            value, 
            new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).addDays(1)
          )

          authData = value
          appUser.set(authData)
          console.log("Reload User Auth...", authData)
        } else {
          console.log("No User Auth.")
        }

        callback()
      })
    })

    if (authData != null) {
      console.log("Stored User Auth...", authData)
      appUser.set(authData)
      callback()
    }
    
  }

  // PROCESS LOADED DATA
  const processData = (callback) => {
    console.log("Process Data...")

    // SAVE APP PARAMETERS
    /* appConfig.set(appConfigStructure)
    appLabels.set(appLabelsStructure)
    gamesCarousel.set(gamesCarouselStructure) */

    if (callback) callback()
  }

  // SETUP APP
  export const setupApp = (callback) => {
    console.log("Setup...")

    loadQueryData(() => loadUserAuth(() => processData((result) => console.log("Show."))))
  }
</script>
