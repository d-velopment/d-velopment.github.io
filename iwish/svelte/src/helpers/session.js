const STORAGEITEMS = {
  EXPDATE: "__expDate",
  ERRTITLE: "%c Storage features are not available ",
  ERRSTYLE: "background: #333; color: #ffb3c5; margin: 10px; padding: 10px; border-bottom-right-radius: 10px;",
}

var storageSupported = true
try {
  const checkKey = Math.random().toString(36).substring(2)
  localStorage.setItem(checkKey, checkKey)
  localStorage.removeItem(checkKey)
} catch {
  storageSupported = false
}

var labelMessage
const isSupported = (callback) => {
  if (storageSupported) {
    return callback()
  }
  if (!labelMessage) {
    console.log((labelMessage = STORAGEITEMS.ERRTITLE), STORAGEITEMS.ERRSTYLE)
  }
  return null
}

const containerSet = (key, json, storage = localStorage) => isSupported(() => storage.setItem(key, JSON.stringify(json)))
const containerGet = (key, callbackOnEmpty, storage = localStorage) => {
  return isSupported(() => {
    if (storage.hasOwnProperty(key)) {
      const returnJSON = JSON.parse(storage.getItem(key))
      if (returnJSON.hasOwnProperty(STORAGEITEMS.EXPDATE))
        if (Date.parse(new Date()) > Date.parse(returnJSON[STORAGEITEMS.EXPDATE])) {
          storage.removeItem(key)
          return null
        }
      return returnJSON
    } else if (callbackOnEmpty) callbackOnEmpty(key)
  })
}
const containerRemove = (key, storage = localStorage) => isSupported(() => storage.removeItem(key))

export const sessionSet = (key, json) => containerSet(key, json, sessionStorage)
export const sessionGet = (key, callbackOnEmpty) => {
  return containerGet(key, callbackOnEmpty, sessionStorage)
}
export const sessionDelete = (key) => containerRemove(key, sessionStorage)

export const permanentSet = (key, json, expireDate) => containerSet(key, { ...json, ...{ [STORAGEITEMS.EXPDATE]: expireDate } })
export const permanentGet = (key, callbackOnEmpty) => {
  return containerGet(key, callbackOnEmpty)
}
export const permanentDelete = (key) => containerRemove(key)

const DataStorage = {
  sessionSet: sessionSet,
  sessionGet: sessionGet,
  sessionDelete: sessionDelete,

  permanentSet: permanentSet,
  permanentGet: permanentGet,
  permanentDelete: permanentDelete,
}
export default DataStorage
