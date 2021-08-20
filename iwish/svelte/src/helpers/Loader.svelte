<script context="module">
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
  import { urlAPI, appConfig, appConfigStructure, appLabelsStructure, appLabels, urlConfiguration } from "../stores/setup.js"

  Array.prototype.first = function () {
    return this[0]
  }

  // LOAD QUERY DATA
  const loadQueryData = (callback) => {
    console.log("Load Query Data...")

    // EXTRA: SAVE WIDGET TYPE PARAMETER
    widgetType.set(appConfigStructure.tournamentType)

    // SAVE APP PARAMETERS
    appConfig.set(appConfigStructure)

    if (callback) callback()
  }

  // LOAD SERVER DATA
  const loadServerData = (callback) => {
    console.log("Load Server Data...")

    /* Server.fetchWeb(urlConfiguration, (value) => {
      console.log("Loaded.")
      if (callback) callback(value)
    }) */
  }

  // PROCESS LOADED DATA
  const processData = (value, callback) => {
    console.log("Process Data...", value)

    // SAVE APP PARAMETERS
    /* appConfig.set(appConfigStructure)
    appLabels.set(appLabelsStructure)
    gamesCarousel.set(gamesCarouselStructure) */

    if (callback) callback()
  }

  // SETUP APP
  export const setupApp = (callback) => {
    console.log("Setup...")

    loadQueryData(() => loadServerData((value) => processData(value, (result) => console.log("Show."))))
  }
</script>
