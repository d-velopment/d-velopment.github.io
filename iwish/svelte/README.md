# Nexus Tournaments

Tournaments Promotions Project 

## Run

To run the project please execute next sequence of commands in 1st Terminal:

```
cd nx_tournaments
npm install
npm run dev
```

To attach the project to Nexus please execute next sequence in 2nd Terminal:
 
```
cd nexus
npm install
npm start
```

Nexus index.ts should be linked to Tournaments:

```
const config = {
  "modules":[
    {"id":"tournamentthingy","priority":1,"translationContext":"hello,there",
      "url":"http://localhost:5000/bundle.js"}
  ],
  "translationApiUrl":"https://d3nsdzdtjbr5ml.cloudfront.net/ubo-casino-api/translations"
}
```

After that open in browser http://0.0.0.0:8080/?gameUrl=https://d3nsdzdtjbr5ml.cloudfront.net/rlxmalmodev/templetumble/GAM-16920/index.html&gameid=templetumble&ticket=testticket-tourtest&channel=mobile&jurisdiction=NO&partnerid=1&moneymode=real (8080 - port of Nexus assigned)

_Note that you will need to have [Node.js](https://nodejs.org) installed._
