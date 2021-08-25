const isNullOrEmpty = (str) => {
  var returnValue = false
  if (!str || str == null || str === "null" || str === "" || str === "{}" || str === "undefined" || str.length === 0) {
    returnValue = true
  }
  return returnValue
}

export const fetchPost = async (url, data, token, callback) => {
  if (isNullOrEmpty(url.trim())) return
  const settings = {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      'Authorization': `${isNullOrEmpty(token) ? '' : 'Bearer ' + token}`
    },
    body: JSON.stringify(data),
  }

  try {
    const response = await fetch(`${url}`, settings)
    {
      try {
        const data = await response.json()
        callback(data)
      } catch (err) {
        console.error(error)
        callback(null)
      }
    }
  } catch {}
}

export const fetchWeb = async (url, callback) => {
  if (isNullOrEmpty(url.trim())) return
  await fetch(`${url}`)
    .then((response) => {
      if (!response.ok) throw new Error("Bad response from server")
      return response.json()
    })
    .then((json) => {
      callback(json)
    })
    .catch((error) => {
      console.error(error)
      callback(null)
    })
}

export const callWebAPI = async (urlAPI, requestId, callback) => {
  if (isNullOrEmpty(urlAPI.trim()) || isNullOrEmpty(requestId.trim())) return
  fetchWeb(`${urlAPI}${requestId}`, callback)
}

export const pingWebAPI = async (url, callback) => {
  await fetch(`${url}`)
    .then((response) => {
      callback(response.ok)
    })
    .catch((error) => {
      console.error(error)
      callback(null)
    })
}

const Server = {
  fetchPost: fetchPost,
  fetchWeb: fetchWeb,
  callWebAPI: callWebAPI,
  pingWebAPI: pingWebAPI,
}
export default Server
