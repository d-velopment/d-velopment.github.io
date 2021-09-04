import { writable } from "svelte/store"

export const urlRoot = "https://coreapi.work"
export const urlAuth = `${urlRoot}/user/authenticate`
export const urlStream = `${urlRoot}/user/stream/` // 0 - INITIAL PAGE

export const appUserStructure = {
  id: null,
  firstName: "",
  lastName: "",
  username: "",
  jwtToken: null,
}
export const appUser = writable(appUserStructure)
