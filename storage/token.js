let GLOBAL_TOKENS = {
  token: null,
  usernameToken: null
};

function setTokens(tokens) {
  GLOBAL_TOKENS = { ...GLOBAL_TOKENS, ...tokens };
}

function getTokens() {
  return GLOBAL_TOKENS;
}

module.exports = { setTokens, getTokens };
