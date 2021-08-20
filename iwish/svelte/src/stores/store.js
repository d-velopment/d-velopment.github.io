import { writable } from "svelte/store"

// WIDGET TYPE
export const WIDGETTYPES = {
  NO: "NONE",
  IN: "INTERNAL",
  HS: "HIGHEST SCORE",
  CR: "CASH RACE",
  BO: "BEST OF",
}
export const widgetType = writable(WIDGETTYPES.IN)

// TOURNAMENT STATES
export const TOURNAMENTSTATES = {
  NONE: -1,
  FUTURE: 3,
  START: 2,
  PROGRESS: 1,
  ENDED: 0,
}

export const COLORMODES = {
  DEFAULT: "color_top",
  NONE: "color_transparent",
  TOP: "color_top",
  FLAT: "color_flat",
  BLACK: "color_black",
  WHITE: "color_white",
}

// WINDOW TABS
export const WIDGETTABS = {
  NO: "NONE",
  OVERVIEW: "OVERVIEW",
  LEADERBOARD: "LEADERBOARD",
  TERMSCONS: "TERMS & CONS",
  RESULTS: "RESULTS",
}

// WIDGET CASH RACE
export const cashRaceStructure = {
  cashRace: [
    {
      title: "cashBigWin",
      icon: "https://roundicons.com/wp-content/uploads/2017/09/Artboard-3-freebie-icon.png",
      value: 1,
      total: 10,
      suffix: "cashSuffixBigWin",
    },
    {
      title: "cashWin",
      icon: "https://roundicons.com/wp-content/uploads/2017/09/Artboard-8-freebie-icon.png",
      value: 7,
      total: 7,
      suffix: "cashSuffixWin",
    },
    {
      title: "cashLose",
      icon: "https://roundicons.com/wp-content/uploads/2017/09/Artboard-29-copy-freebie-icon.png",
      value: 1,
      total: 8,
      suffix: "cashSuffixLose",
    },
    {
      title: "cashScatter",
      icon: "https://roundicons.com/wp-content/uploads/2017/09/Artboard-3-freebie-icon.png",
      value: 4,
      total: 6,
      suffix: "cashSuffixScatter",
    },
    {
      title: "cashWild",
      icon: "https://roundicons.com/wp-content/uploads/2017/09/Artboard-8-freebie-icon.png",
      value: 5,
      total: 7,
      suffix: "cashSuffixWild",
    },
    {
      title: "cashTrigger",
      icon: "https://roundicons.com/wp-content/uploads/2017/09/Artboard-29-copy-freebie-icon.png",
      value: 7,
      total: 7,
      suffix: "cashSuffixTrigger",
    },
  ],
}
export const widgetCashRace = writable(cashRaceStructure)

// WIDGET GAMES CAROUSEL
export const gamesCarouselStructure = {
  gamesCarousel: [
    {
      title: "Money Train 2",
      image: "https://picsum.photos/id/973/200/300",
    },
    {
      title: "Money Train 3",
      image: "https://picsum.photos/id/974/200/300",
    },
    {
      title: "Money Train 4",
      image: "https://picsum.photos/id/975/200/300",
    },
    {
      title: "Money Train 5",
      image: "https://picsum.photos/id/976/200/300",
    },
    {
      title: "Money Train 6",
      image: "https://picsum.photos/id/977/200/300",
    },
  ],
}
export const gamesCarousel = writable(gamesCarouselStructure)

// TIME MONITOR
export const tournamentTimeStructure = {
  startsAt: undefined,
  endsAt: undefined,
  tournamentState: undefined,
  tournamentPreviousState: undefined,
  estimationTime: undefined,
  timer: undefined,
}
export const tournamentTime = writable(tournamentTimeStructure)

// PLAYER RANK
export const playerStructure = {
  playerName: undefined,
  playerCompany: undefined,
  playerRank: undefined,
  playerPrize: undefined,
  playerBestRank: 15,
  playerBestRankMax: 30,
  playerBestPoints: 5000,
  playerSpins: 10,
  playerSpinsMax: 20,
  playerPoints: 200,
  playerScore: 2000,
}
export const player = writable(playerStructure)

// PAGE LEADERBOARD
export const leaderBoardStructure = {
  leaderboard: [
    [1, 315000, 0, "Alice du Crest", "06NJ30"],
    [2, 287000, 0, "Adam G", "DQL2ZT"],
    [3, 221000, 0, "Björn FF", "MQ2MBD"],
    [4, 184000, 0, "Martin L", "HEA5RK"],
    [5, 172000, 0, "Morten_Ninja", "PXWWVC"],
    [6, 163000, 0, "Johanna", "YV09LP"],
    [7, 155000, 0, "Harry", "GH3JGX"],
    [8, 144000, 0, "Joel Salonen", "O9ILLO"],
    [9, 94000, 0, "Kan", "4H665W"],
    [10, 93000, 0, "Nils", "40CL0E"],
    [11, 89000, 0, "Sally B", "4DAJ2P"],
    [12, 82000, 0, "Jacqui", "6666"],
    [13, 78000, 0, "Goli R", "YASZ9F"],
    [14, 75000, 0, "Torbjorn Schei", "CPBOY4"],
    [14, 75000, 0, "Stanislav", "MQ2MBD"],
    [16, 74000, 0, "Rikke Lemann", "DLJ7ZZ"],
    [17, 70000, 0, "Marie", "GQ497R"],
    [17, 70000, 0, "Heidi Lind", "DLJ7ZZ"],
    [19, 62000, 0, "André", "UG91ND"],
    [20, 56000, 1, "Ashley Bloor", "GOT8NL"],
    [21, 54000, 0, "Jacgat", "HEA5RK"],
    [22, 53000, 0, "Okan", "4H665W"],
    [23, 45000, 0, "Justin Griffit", "V74JKD"],
    [24, 40000, 0, "DanaOzolina", "SMCIAY"],
    [25, 37000, 0, "Anders", "ZRFNU2"],
    [26, 31000, 0, "Bob Fox", "SMCIAY"],
    [27, 30000, 0, "Helene", "AU8HY5"],
    [28, 29000, 0, "Daniel", "O9ILLO"],
    [29, 28000, 0, "Henrik Krieger", "UG91ND"],
    [30, 27000, 0, "Clayton", "EGOW0Y"],
  ],
}
export const leaderBoard = writable(leaderBoardStructure)

// PAGE TERMS & CONS
export const termsConditionsStructure = {
  upDate: new Date(),
}
export const termsConditions = writable(termsConditionsStructure)

// PAGE RESULTS
export const resultsInfoStructure = {
  results: {
    winTreshold: 3,
  },
}
export const resultsInfo = writable(resultsInfoStructure)
