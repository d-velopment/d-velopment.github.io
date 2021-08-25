<script>
  import { onMount } from "svelte"

  import { setupApp } from "./helpers/Loader.svelte"

  import Application from "./components/Application.svelte"

  setupApp()
</script>

<Application />
