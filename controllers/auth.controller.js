const axios = require("axios");
const FormData = require("form-data");
const SystemConfig = require("../models/SystemConfig");
const { LOGIN_URL, AUTH } = require("../config/config");
const { setToken, getToken } = require("../storage/token"); // ensure storage/token.js exist

async function login() {
  try {
    const form = new FormData();
    form.append("account_id", AUTH.account_id);
    form.append("password", AUTH.password);
    form.append("verify_token", "");
    form.append("country_code", AUTH.country_code);

    const res = await axios.post(LOGIN_URL, form, {
      headers: {
        ...form.getHeaders(),
        "User-Agent": "Mozilla/5.0 Chrome/120",
        Origin: "https://www.gugobet.net",
        Referer: "https://www.gugobet.net/",
      },
      timeout: 15000,
    });

    if (!res.data?.token) {
      throw new Error("TOKEN_NOT_RECEIVED");
    }

    // 🔑 SAVE TOKEN IN GLOBAL STORE
    setToken(res.data.token);

    // 💾 SAVE TO MONGODB
    await SystemConfig.findOneAndUpdate(
      { key: "AUTH_TOKEN" },
      { value: res.data },
      { upsert: true, returnDocument: 'after' }
    );

    console.log("🔑 AUTH TOKEN UPDATED AND SAVED");

    return res.data.token;
  } catch (err) {
    console.log("❌ AUTH LOGIN FAILED:", err.message);
    throw err; // let cron handle retry
  }
}

async function loadToken() {
  try {
    const doc = await SystemConfig.findOne({ key: "AUTH_TOKEN" });
    if (doc && doc.value) {
      setToken(doc.value.token);
      console.log("✅ LOADED TOKEN FROM DB");
      return doc.value.token;
    }
  } catch (e) {
    console.log("⚠️ COULD NOT LOAD TOKEN FROM DB:", e.message);
  }
  return null;
}

module.exports = { login, loadToken, getToken };
