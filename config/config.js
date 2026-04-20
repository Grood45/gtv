require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 4000,

  LOGIN_URL: "https://bigwin.live/api/user/user-login",

  BIGWIN_KEY_URL: "https://bigwin.live/api/sport/get-key-and-login",

  STREAM_API:
    "https://bkqawscf.gu21go76.xyz/exchange/member/playerService/getStreamingUrl",

  LIVE_EVENT_COUNT_API:
    "https://bxawscf.gu21go76.xyz/exchange/member/playerService/queryOnLiveEvents",

  EVENTS_API:
    "https://bxawscf.gu21go76.xyz/exchange/member/playerService/queryEvents",

  SPORT_EVENTS_API:
    "https://bxawscf.gu21go76.xyz/exchange/member/playerService/queryEventsWithMarket",

  BOOKMAKER_API:
    "https://bxawscf.gu21go76.xyz/exchange/member/playerService/queryBookMakerMarkets",

  FULL_MARKETS_API:
    "https://bxawscf.gu21go76.xyz/exchange/member/playerService/queryFullMarkets",

  OCER_MENU_API:
    "https://bxawscf.gu21go76.xyz/exchange/member/playerService/queryOcerMenu",

  FANCY_RESULT_API:
    "https://bxawscf.gu21go76.xyz/member/reportController/queryMarketListForResultPage",

  EVENT_RESULTS_API:
    "https://bxawscf.gu21go76.xyz/member/reportController/queryEventResults",

  // 🕵️ Expert Alignments
  // 🕵️ Expert Alignments
  DEFAULT_ORIGIN: "https://bigwin.live",
  DEFAULT_REFERER: "https://bigwin.live/",

  AUTH: {
    username: process.env.AUTH_ACCOUNT_ID,
    password: process.env.AUTH_PASSWORD,
    site_auth_key: process.env.SITE_AUTH_KEY || "BspAuthKey123",
  },
};
