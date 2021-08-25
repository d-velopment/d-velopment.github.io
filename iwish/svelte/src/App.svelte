<script>
  import { onMount } from "svelte"

  import { appConfig } from "./stores/setup.js"
  import { setupApp } from "./helpers/Loader.svelte"

  import Application from "./components/Application.svelte"

  setupApp()
</script>

<Application />
