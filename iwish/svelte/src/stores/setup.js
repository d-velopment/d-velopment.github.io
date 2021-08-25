import { writable } from "svelte/store"

export const urlAuth = "https://localhost:5001/user/authenticate"
export const urlStream = "https://localhost:5001/user/stream/" // 0 - INITIAL PAGE

export const appUserStructure = {
  id: null,
  firstName: "",
  lastName: "",
  username: "",
  jwtToken: null,
}
export const appUser = writable(appUserStructure)
