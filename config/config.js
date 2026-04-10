require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 4000,

  LOGIN_URL: "https://api.gugobet.net/api/v1/member/login",

  GAME_API:
    "https://api.gugobet.net/api/v2/game/getGameUrl?game_code=4%40sport&platform_name=ninew3&mobile=1&category=sports&icon_key=1973",

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

  // 🕵️ Expert Alignments
  DEFAULT_ORIGIN: "https://www.gu21go76.xyz",
  DEFAULT_REFERER: "https://www.gu21go76.xyz/",

  AUTH: {
    account_id: process.env.AUTH_ACCOUNT_ID,
    password: process.env.AUTH_PASSWORD,
    country_code: process.env.AUTH_COUNTRY_CODE,
  },
};
