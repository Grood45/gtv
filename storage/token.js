let GLOBAL_TOKEN = null;
function setToken(token) { GLOBAL_TOKEN = token; }
function getToken() { return GLOBAL_TOKEN; }
module.exports = { setToken, getToken };
