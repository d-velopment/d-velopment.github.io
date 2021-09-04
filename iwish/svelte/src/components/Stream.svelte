<script>
  import Server from "../helpers/server.js"
  import { urlStream, appUser } from "../stores/setup.js"
  import { fly } from "svelte/transition"

  const formatDate = (date) => {
    const eventDate = new Date(date)
    const nowDate = new Date()
    const monthNames = ["Января", "Февраля", "Марта", "Апреля", "Мая", "Июня", "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря"]
    return `
      ${eventDate.getDate()}
      ${monthNames[eventDate.getMonth()]}
      ${eventDate.getFullYear() == nowDate.getFullYear() + 1 ? "следующего года" : ""}
    `
  }

  let pageIndex = 0
  let pageItemsSize = -1 // DETECT ONE PAGE ELEMENTS AMOUNT (FOR FLY.DELAY CALCULATION AND PRE-DETECT END OF A LIST)
  let isNextPageLoaded = false
  let isLastPageLoaded = false
  let streamDictionary = {}
  let streamShow = []

  // LOAD STREAM DATA
  const loadStreamPage = (page, token, callback) => {

    if (token == null || isLastPageLoaded) return

    console.log(token)
    Server.fetchGet(`${urlStream}${page}`, token, (value) => {
      console.log("Load Stream Page #", page, value)

      const compiledValue = (0, eval)(`(${value.details})`)

      if (compiledValue.length == 0) {
        isLastPageLoaded = true
        return
      }

      pageItemsSize = pageItemsSize == -1 ? compiledValue.length : pageItemsSize

      streamDictionary[page] = compiledValue
      streamShow = Object.keys(streamDictionary).reduce(function (r, k) {
        return r.concat(streamDictionary[k])
      }, [])

      console.log("Loaded stream elements", streamShow)

      if (compiledValue.length != pageItemsSize) {
        isLastPageLoaded = true
      }

      if (callback) callback(value)
    })
  }

  let userDetails
  appUser.subscribe((value) => {
    userDetails = value
    loadStreamPage(pageIndex, userDetails.jwtToken, (value) => (isNextPageLoaded = true))
  })

  window.addEventListener("scroll", (e) => {
    var h = document.documentElement,
      b = document.body,
      st = "scrollTop",
      sh = "scrollHeight"
    const scr = ((h[st] || b[st]) / ((h[sh] || b[sh]) - h.clientHeight)) * 100

    if (isNextPageLoaded && scr > 50) {
      isNextPageLoaded = false
      pageIndex++
      loadStreamPage(pageIndex, userDetails.jwtToken, (value) => (isNextPageLoaded = true))
    }
  })
</script>

<style>
  sup {
    font-size: 1.2rem;
    font-weight: 500;
  }

  .loader {
    position: absolute;
    height: 50px;
    width: 100%;
    margin-top: 8px;
  }

  .loading {
    background-image: url("assets/loading.svg");
    height: 100%;
    width: 100%;
    background-position: center;
    background-repeat: no-repeat;
    background-size: contain;
  }
</style>

<section class="features8 cid-shi8I9qCDA" id="features9-2">
  <div class="container">
    {#each streamShow as card, i}
      <div in:fly="{{ y: -25, delay: (i % pageItemsSize) * 100 }}" class="card">
        <div class="card-wrapper">
          <div class="row align-items-center">
            <div class="col-12 col-md-4">
              <div class="image-wrapper" style="background-image: url('{card.Image}');"></div>
            </div>
            <div class="col-12 col-md">
              <div class="card-box">
                <div class="row">
                  <div class="col-md">
                    <h6 class="card-title mbr-fonts-style display-5">
                      <strong>{card.Title}</strong>
                    </h6>
                    <p class="mbr-text mbr-fonts-style grey bottom-less">
                      {card.FriendFirstName}
                      {card.FriendLastName},
                      {formatDate(card.EventDate)}
                    </p>
                    <p class="mbr-text mbr-fonts-style display-7">
                      {card.Description1}
                      <i
                        >на
                        {card.EventTitle}
                        {new Date(card.EventDate).getFullYear() == new Date().getFullYear() + 2 ? "через год" : ""}
                      </i>
                    </p>
                  </div>
                  <div class="col-md-auto">
                    <p class="price mbr-fonts-style display-2">{card.Price}<sup>00</sup></p>
                    <div class="mbr-section-btn">
                      <a href="index.html" class="btn btn-primary display-4 {card.IsReserved == 1 ? 'blocked' : ''}"
                        >{card.IsReserved == 1 ? "Бронь" : "Подарить"}</a>
                    </div>
                  </div>
                  <div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>

  {#if !isNextPageLoaded && !isLastPageLoaded}
    <div class="loader">
      <div class="loading"></div>
    </div>
  {/if}
</section>
