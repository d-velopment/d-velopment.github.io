<script>
  import { onMount } from "svelte"

  import { appConfig } from "./stores/setup.js"
  import { setupApp } from "./helpers/Loader.svelte"

  import Application from "./components/Application.svelte"

  setupApp()
</script>

<style>
  /* OVERALL VIEW */
  main {
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 0px;
    margin: 0px;
    height: 100vh;
    width: 100%;
    background: rgba(0, 0, 0, 0);
    pointer-events: none;
  }
  h3 {
    color: #fff;
  }
  :global(.backgroundGame) {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    border-width: 0px;
  }
  :global(.disablePointer) {
    pointer-events: none;
  }
  :global(.fixed) {
    position: fixed;
  }
  :global(.logoImg) {
    opacity: 0.5;
  }
</style>

<svelte:head>
  <link rel="stylesheet" href="assets/web/assets/mobirise-icons2/mobirise2.css" />
  <link rel="stylesheet" href="assets/tether/tether.min.css" />
  <link rel="stylesheet" href="assets/bootstrap/css/bootstrap.min.css" />
  <link rel="stylesheet" href="assets/bootstrap/css/bootstrap-grid.min.css" />
  <link rel="stylesheet" href="assets/bootstrap/css/bootstrap-reboot.min.css" />
  <link rel="stylesheet" href="assets/dropdown/css/style.css" />
  <link rel="stylesheet" href="assets/socicon/css/styles.css" />
  <link rel="stylesheet" href="assets/theme/css/style.css" />
  <link rel="preload" as="style" href="assets/mobirise/css/mbr-additional.css" />
  <link rel="stylesheet" href="assets/mobirise/css/mbr-additional.css" type="text/css" />
  <script defer src="assets/web/assets/jquery/jquery.min.js"></script>
  <script defer src="assets/popper/popper.min.js"></script>
  <script defer src="assets/tether/tether.min.js"></script>
  <script defer src="assets/bootstrap/js/bootstrap.min.js"></script>
  <script defer src="assets/smoothscroll/smooth-scroll.js"></script>
  <script defer src="assets/dropdown/js/nav-dropdown.js"></script>
  <script defer src="assets/dropdown/js/navbar-dropdown.js"></script>
  <script defer src="assets/touchswipe/jquery.touch-swipe.min.js"></script>
  <!-- script defer src="assets/theme/js/script.js"></script -->
</svelte:head>

<Application />
