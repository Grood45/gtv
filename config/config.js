module.exports = {
  PORT: 4000, // ✅ VPS ke liye BEST (3000 busy hota hai)

  LOGIN_URL: "https://api.gugobet.net/api/v1/member/login",

  GAME_API:
    "https://api.gugobet.net/api/v2/game/getGameUrl?game_code=4%40sport&platform_name=ninew3&mobile=1&category=sports&icon_key=1973",

  STREAM_API:
    "https://bkqawscf.gu21go76.xyz/exchange/member/playerService/getStreamingUrl",

  LIVE_EVENT_COUNT_API:
    "https://saapipl.gu21go76.xyz/exchange/member/playerService/queryOnLiveEvents",

  EVENTS_API:
    "https://bxawscf.skyinplay.com/exchange/member/playerService/queryEvents",

  SPORT_EVENTS_API:
    "https://saapipl.gu21go76.xyz/exchange/member/playerService/queryEventsWithMarket",

  BOOKMAKER_API:
    "https://saapipl.gu21go76.xyz/exchange/member/playerService/queryBookMakerMarkets",

  FULL_MARKETS_API:
    "https://saapipl.gu21go76.xyz/exchange/member/playerService/queryFullMarkets",

  AUTH: {
    account_id: "7895289296",
    password: "Sher@123",
    country_code: "91",
  },
};
