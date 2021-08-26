<script>
  import Server from "../helpers/server.js"
  import { urlStream, appUser } from "../stores/setup.js"

  const formatDate = (date) => {
    const eventDate = new Date(date)
    const monthNames = ["Января", "Февраля", "Марта", "Апреля", "Мая", "Июня", "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря"]
    return `
      ${eventDate.getDate()}
      ${monthNames[eventDate.getMonth()]}
      ${eventDate.getFullYear()}
      года
    `
  }

  let pageIndex = 0
  let streamDictionary = {}
  let streamShow = []

  // LOAD STREAM DATA
  const loadStreamPage = (page, token, callback) => {
    if (token == null) return
    Server.fetchGet(`${urlStream}${page}`, token, (value) => {
      console.log("Load Stream Page #", page)

      const compiledValue = (0, eval)(`(${value.details})`)
      streamDictionary[page] = compiledValue
      streamShow = Object.keys(streamDictionary).reduce(function (r, k) {
        return r.concat(streamDictionary[k])
      }, [])

      console.log("Loaded stream elements", streamShow)

      if (callback) callback(value)
    })
  }

  let userDetails
  appUser.subscribe((value) => {
    userDetails = value

    loadStreamPage(pageIndex, userDetails.jwtToken, (value) => {
      setTimeout(() => loadStreamPage(pageIndex + 1, userDetails.jwtToken), 2000)
    })
  })
</script>

<style>
  sup {
    font-size: 1.2rem;
    font-weight: 500;
  }
</style>

<section class="features8 cid-shi8I9qCDA" id="features9-2">
  <div class="container">
    {#each streamShow as card, i}
      <div class="card">
        <div class="card-wrapper">
          <div class="row align-items-center">
            <div class="col-12 col-md-4">
              <div class="image-wrapper" style="background-image: url('{card.Image}');">
                <!--img src="{card.Image}" alt="{card.Title}" /-->
              </div>
            </div>
            <div class="col-12 col-md">
              <div class="card-box">
                <div class="row">
                  <div class="col-md">
                    <h6 class="card-title mbr-fonts-style display-5">
                      <strong>{card.Title}</strong>
                    </h6>
                    <p class="mbr-text mbr-fonts-style grey">
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
                    <div class="mbr-section-btn"><a href="index.html" class="btn btn-primary display-4">Подарить</a></div>
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
</section>
