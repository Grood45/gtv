# fastodds.online API Reference

The following is a comprehensive list of all available API endpoints for the **FastOdds** system. All APIs are optimized for high-speed delivery and utilize the Bigwin authentication layer.

**Base URL**: `https://fastodds.online`

---

## 🎥 1. Streaming APIs
Retrieve live streaming URLs for any match.

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/glivestreaming/v1/glive/:matchId` | **GET** | Primary streaming URL generator. |
| `/glivestreaming/v1/event/:eventId` | **GET** | Fetch stream by Event ID. |

---

## 📊 2. Betting Odds (Real-time)
Fetch live prices and markets. Data is cached (L1/Redis) for performance.

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/nw/v1/fancy/:eventId` | **GET** | Fetch **Fancy Odds** for a specific event. |
| `/nw/v1/bookmaker/:eventId` | **GET** | Fetch **Bookmaker** markets for an event. |
| `/nw/v1/fullMarkets/:eventId/:marketId` | **GET** | Fetch detailed data for a specific market. |

---

## 🏆 3. Results APIs
Access past results and settlement data.

| Endpoint | Method | Parameters |
| :--- | :--- | :--- |
| `/nw/v1/result/fancy` | **GET** | `?eventId=35503673` (Fetch fancy results) |
| `/nw/v1/result/event` | **GET** | `?type=today&sportId=4` (Fetch general results) |

---

## 📅 4. Event Management
Browse live and upcoming matches across multiple sports.

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/nw/v1/counts` | **GET** | Get counts of live matches per sport. |
| `/nw/v1/inplay` | **GET** | List all matches currently **In-Play**. |
| `/nw/v1/today` | **GET** | List all matches scheduled for **Today**. |
| `/nw/v1/tomorrow` | **GET** | List all matches scheduled for **Tomorrow**. |
| `/nw/v1/sport/list?sportId=:id` | **GET** | Filter events by Sport ID (1:Soccer, 2:Tennis, 4:Cricket). |
| `/nw/v1/menu/menu` | **GET** | Global hierarchical menu (Sports -> Competition -> Event). |

---

## 🛠️ 5. Utility & Debugging
Internal checks and toolsets.

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/debug/status` | **GET** | Check health of Bigwin Cookie/Token systems. |
| `/debug/events` | **GET** | View currently tracked events in Database. |
| `/test` | **GET** | HTML-based Iframe Embed Code Generator. |

---

## 🔒 Security & Performance
*   **Direct Connect**: All requests are sent directly to the provider for minimum latency (Proxies removed).
*   **Rate Limiting**: Normal endpoints have limits, but `/nw/v1/*` paths are optimized for unlimited expert traffic.
*   **Self-Healing**: System automatically refreshes auth sessions without downtime.
