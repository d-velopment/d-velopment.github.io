import { writable } from "svelte/store"

export const urlConfiguration = "https://dev-cdn.relaxg.net/casino/nexus/nexus-assets/nx_tournaments/setup.json"
export const urlAPI = "https://dev-casino-client.api.relaxg.net/capi/1.0/casino/eventtournaments/leaderboard?tournamentid="
export const urlTranslations = "https://dev-cdn.relaxg.net/ubo-casino-api/translations?context=macguffin&locale=" // en_US

export const appConfigStructure = {
  tournamentId: undefined,
  tournamentType: undefined,
  urlGame: undefined,
  playerInfo: undefined,
  playerRank: undefined,

  colorMode: "",

  inStartsAt: undefined,
  inEndsAt: undefined,
  isCancelled: undefined,

  isTournamentAvailable: undefined,
  isTournamentEntered: undefined, // Undefined = No Decision from player, True = Accepted, False = Declined
  isPlayerAvailable: undefined,
  isEmbeddableWidget: undefined,
  isGameAvailable: undefined,
  isGameVisible: true,
}
export const appConfig = writable(appConfigStructure)

export const appLabelsStructure = {
  appTitle: "Tournament",
  appSubTitle: "Welcome to the First Annual Relax Tournament",
  appInfo: [
    "Get to the top of the leaderboard! The top 3 participating players in this tournament will each win a prize depending on their final rank. The higher your rank, the better the prize.",
    "<h3>1st Prize - € XXXXXXXX</h3>",
    "<h3>2st Prize - € XXXXXXX</h3>",
    "<h3>3st Prize - € XXXXXX</h3>",
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus justo ipsum, accumsan nec ultricies nec, lobortis ac libero. Nullam ac nulla id augue condimentum gravida quis a est. In ultrices scelerisque placerat. Mauris nec ex porta, porttitor dolor eget, laoreet dui. Aenean mauris elit, consequat nec dignissim vitae, fringilla ac est.",
    "Sed vitae dui vitae ante semper sagittis. Cras vitae lorem pretium, fermentum diam non, venenatis sapien. Sed sed sapien non ante venenatis pulvinar tincidunt in velit. Morbi dui nibh, vulputate ac ante mollis, ullamcorper interdum urna.",
    "Aliquam ac purus quis massa mattis tempus at et diam. Ut consectetur eros diam, quis volutpat tortor condimentum in. Nunc ac viverra sapien, vel viverra quam.",
    "Proin semper lacinia ipsum in congue. Aenean efficitur neque non dui elementum, non volutpat libero commodo. Nullam interdum placerat ipsum sed pellentesque. Sed vehicula condimentum interdum.",
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus justo ipsum, accumsan nec ultricies nec, lobortis ac libero. Nullam ac nulla id augue condimentum gravida quis a est. In ultrices scelerisque placerat. Mauris nec ex porta, porttitor dolor eget, laoreet dui. Aenean mauris elit, consequat nec dignissim vitae, fringilla ac est.",
    "Sed vitae dui vitae ante semper sagittis. Cras vitae lorem pretium, fermentum diam non, venenatis sapien. Sed sed sapien non ante venenatis pulvinar tincidunt in velit. Morbi dui nibh, vulputate ac ante mollis, ullamcorper interdum urna.",
    "Aliquam ac purus quis massa mattis tempus at et diam. Ut consectetur eros diam, quis volutpat tortor condimentum in. Nunc ac viverra sapien, vel viverra quam.",
    "Proin semper lacinia ipsum in congue. Aenean efficitur neque non dui elementum, non volutpat libero commodo. Nullam interdum placerat ipsum sed pellentesque. Sed vehicula condimentum interdum.",
  ],
  appTerms: [
    "Far far away, behind the word mountains, far from the countries Vokalia and Consonantia, there live the blind texts. Separated they live in Bookmarksgrove right at the coast of the Semantics, a large language ocean.",
    "A small river named Duden flows by their place and supplies it with the necessary regelialia. It is a paradisematic country, in which roasted parts of sentences fly into your mouth.",
    "Even the all-powerful Pointing has no control about the blind texts it is an almost unorthographic life One day however a small line of blind text by the name of Lorem Ipsum decided to leave for the far World of Grammar.",
    "The Big Oxmox advised her not to do so, because there were thousands of bad Commas, wild Question Marks and devious Semikoli, but the Little Blind Text didn’t listen.",
    "She packed her seven versalia, put her initial into the belt and made herself on the way.",
    "When she reached the first hills of the Italic Mountains, she had a last view back on the skyline of her hometown Bookmarksgrove, the headline of Alphabet Village and the subline of her own road, the Line Lane.",
    "Pityful a rethoric question ran over her cheek, then she continued her way. On her way she met a copy.",
    'The copy warned the Little Blind Text, that where it came from it would have been rewritten a thousand times and everything that was left from its origin would be the word "and" and the Little Blind Text should turn around and return to its own, safe country.',
    "But nothing the copy said could convince her and so it didn’t take long until a few insidious Copy Writers ambushed her, made her drunk with Longe and Parole and dragged her into their agency, where they abused her for their projects again and again. And if she hasn’t been rewritten, then they are still using her.",
    "Far far away, behind the word mountains, far from the countries Vokalia and Consonantia, there live the blind texts. Separated they live in Bookmarksgrove right at the coast of the Semantics, a large language ocean. A small river named Duden flows by their place and supplies it with the necessary regelialia. It is a paradisematic country, in which roasted parts of sentences fly into your mouth. Even the all-powerful Pointing has no control about the blind texts it is an almost unorthographic life One.",
  ],
  appGames: [],

  tabOver: "Overview",
  tabLead: "Leaderboard",
  tabTerm: "Terms",
  tabTermCond: "Terms & Conditions",

  leadRank: "Rank",
  leadPlayer: "Player",
  leadPoint: "Points",
  leadPrize: "Prize",

  timeStart: "Start",
  timeEnd: "End",
  timeSIn: "Starts In",
  timeSOn: "Starts On",
  timeEIn: "Ends In",
  timeEOn: "Ended On",

  infoSelect: "Select a game",
  infoGames: "Games in This Tournament",
  infoGoals: "Goals",
  infoSpins: "Spins",
  infoPoints: "Points",
  infoScore: "User High Score",
  infoAgain: "Give it another go?",
  infoTry: "Try again",

  yes: "YES",
  no: "NO",

  optIn: "Join",
  optOut: "Decline",
  optTerms: "By opting in, you are accepting the T&Cs",

  noteStart: "Tournament starts now. Climb the leaderboard and collect your rewards. Good luck!",
  noteEndSoon: "Don't miss out, it's your last chance for an awesome reward. The tournament is about to end soon.",
  noteEnd: "Tournament has ended. Check your results.",
  noteBet: "Your bets are below the qualifying amount {qualifyingAmount}",
  noteCancel: "The tournament has been cancelled.",

  resTitle: "The tournament has come to an end!",
  resWin: "Congratulations! You've placed {value} and collected a reward. Tune in soon for the next competition.",
  resPrize: "You won {value}!",
  resLose: "You placed at rank {value}. Try again in the next tournament for a chance to win a prize!",
  resFinal: "Thank you for playing!",

  cashBigWin: "Get {value} big wins",
  cashWin: "Get {value} wins in a row",
  cashLose: "Get {value} losses in a row",
  cashScatter: "Get {value} scatter symbols",
  cashWild: "Get {value} wild symbols",
  cashTrigger: "Trigger the bonus feature {value} times",

  cashSuffixBigWin: "big wins",
  cashSuffixWin: "wins",
  cashSuffixLose: "losses",
  cashSuffixMulti: "multiplier",
  cashSuffixScatter: "scatters",
  cashSuffixWild: "wilds",
  cashSuffixTrigger: "features",
}
export const appLabels = writable(appLabelsStructure)

export const appValuesStructure = {}
export const appValues = writable(appValuesStructure)
