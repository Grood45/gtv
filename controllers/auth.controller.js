const axios = require("axios");
const SystemConfig = require("../models/SystemConfig");
const { LOGIN_URL, AUTH } = require("../config/config");
const { setTokens, getTokens } = require("../storage/token");

async function login() {
  try {
    console.log("📡 ATTEMPTING BIGWIN LOGIN...");
    
    // Payload for Bigwin login
    const payload = {
      username: AUTH.username,
      password: AUTH.password,
      site_auth_key: AUTH.site_auth_key
    };

    const res = await axios.post(LOGIN_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:149.0) Gecko/20100101 Firefox/149.0",
        "Origin": "https://bigwin.live",
        "Referer": "https://bigwin.live/"
      },
      timeout: 15000,
    });

    if (!res.data?.success || !res.data?.data?.token) {
      console.log("❌ BIGWIN LOGIN FAILED:", res.data?.message || "Invalid Response");
      throw new Error("BIGWIN_LOGIN_FAILED");
    }

    const { token, usernameToken } = res.data.data;

    // 🔑 SAVE TOKENS IN GLOBAL STORE
    setTokens({ token, usernameToken });

    // 💾 SAVE TO MONGODB
    await SystemConfig.findOneAndUpdate(
      { key: "AUTH_TOKEN" },
      { value: { token, usernameToken } },
      { upsert: true, returnDocument: 'after' }
    );

    console.log("🔑 BIGWIN TOKENS UPDATED AND SAVED");

    return token;
  } catch (err) {
    console.log("❌ AUTH LOGIN FAILED:", err.response?.data || err.message);
    throw err;
  }
}

async function loadToken() {
  try {
    const doc = await SystemConfig.findOne({ key: "AUTH_TOKEN" });
    if (doc && doc.value) {
      setTokens({ 
        token: doc.value.token, 
        usernameToken: doc.value.usernameToken 
      });
      console.log("✅ LOADED TOKENS FROM DB");
      return doc.value.token;
    }
  } catch (e) {
    console.log("⚠️ COULD NOT LOAD TOKENS FROM DB:", e.message);
  }
  return null;
}

module.exports = { login, loadToken, getTokens };
