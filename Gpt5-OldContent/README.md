<div align="center">

# Azure GPT Mini Chat (Frontend Only)

Stream chat completions (Responses API) from an Azure AI Foundry (OpenAI‑compatible) deployment directly in the browser – no custom backend.

</div>

## ✨ Features

- Pure static front‑end: just open `index.html` in a browser (or serve via any static host)
- User supplies: API Key, Endpoint URL, Deployment (model) name, API version
- Supports both new `/responses` endpoint (default) and legacy `/chat/completions`
- True streaming with incremental token display (SSE parsing)
- Abort / Stop button (uses `AbortController`)
- Conversation state kept in memory (clears with page refresh or Clear button)
- Optional persistence of non‑sensitive settings (and opt‑in storage of API key)
- Usage token summary (if the service returns usage in the final event)
- Dark‑mode friendly styling (respects `color-scheme`)

## 🚀 Quick Start

1. Create (or identify) an Azure AI Foundry / Azure OpenAI resource and a model deployment (e.g. `gpt-5-mini`).
2. Open `index.html` locally:
	- Easiest: drag the file into a modern browser (Chrome, Edge, Firefox). Some browsers restrict local `fetch`; if streaming fails locally, serve it:
	  ```bash
	  python -m http.server 8080
	  # then visit http://localhost:8080
	  ```
3. Click the gear icon (⚙️) to open Settings.
4. Fill in:
	- Endpoint: `https://YOUR-RESOURCE.openai.azure.com`
	- Deployment / Model ID: your deployment name (not the base model family)
	- API Version: e.g. `2024-08-01-preview` (confirm in Azure docs / portal)
	- API Key: one of your keys for the resource (or a delegated key)
5. (Optional) Adjust temperature.
6. Hit Save Settings (persists if the remember boxes are checked).
7. Type a prompt and press Enter (or Send) – tokens stream in real time.

## ⚠️ Security Notice

This project intentionally has **no backend**. Your API key is used **directly in the browser**:

- Any JavaScript running on the page (including injected extensions) can read it.
- If you deploy this static site publicly, visitors will have to trust the served code.
- For production scenarios, you should proxy requests via a minimal backend that injects a **secure server‑side key** or uses Azure Entra ID / managed identity.

Use a limited-scope key (if available) or rotate regularly. Never embed the key in the repo.

## 🔧 Configuration Fields

| Field | Purpose | Notes |
|-------|---------|-------|
| API Key | Authenticates to Azure | Stored only if you explicitly check "Remember key" |
| Endpoint | Base resource URL | No trailing slash (script trims one) |
| Deployment / Model ID | Your deployment name | Must match a deployed model |
| API Version | REST API version | Keep updated with Azure documentation |
| Temperature | Randomness | 0 = deterministic |
| Use /responses | Toggle new Responses API | If unchecked uses legacy chat/completions |
| Remember non-sensitive settings | Persists endpoint/deployment/version | Uses `localStorage` |

## 🧵 Streaming Implementation

The client sends `Accept: text/event-stream` and `stream: true` in the request body. It parses server-sent events (SSE) lines beginning with `data:` until `[DONE]` or a `response.completed` event (Responses API). Partial deltas update the assistant message live.

### Responses API Event Types (sample handled)
- `response.output_text.delta` – incremental text delta
- `response.completed` – final event (usage + finish)
- `response.error` – error payload

Legacy `/chat/completions` streaming is also parsed (choices[0].delta.content, finish_reason).

## 📁 File Overview

| File | Purpose |
|------|---------|
| `index.html` | Markup + settings + chat layout |
| `style.css` | Dark themed responsive styling |
| `app.js` | Core logic: settings persistence, streaming fetch, SSE parsing, abort handling |

## 🛠 Local Parser Self-Test

Open DevTools console and run:
```js
testSSEParser();
```
This simulates a small sequence of streaming events and verifies accumulation logic without calling the network.

## ❗ Troubleshooting

| Issue | Possible Cause / Fix |
|-------|----------------------|
| 401 / 403 | Wrong key, key not authorized, deployment name mismatch |
| CORS error | Azure endpoint may not allow direct browser calls in your configuration; consider a proxy |
| No streaming (waits then dumps) | Endpoint not honoring SSE or missing `Accept: text/event-stream` |
| Model not found | Typo in deployment name |
| Usage not showing | Endpoint didn’t include usage in final event |

## ➕ Potential Enhancements

- Add markdown rendering + code block syntax highlighting
- Add system / developer message configuration
- Add export/import of conversation transcript (JSON & Markdown)
- Add token counting estimation client-side
- Provide optional backend proxy template (Node / Python)

## 📝 License

Choose a license before sharing publicly (e.g. MIT). Currently unlicensed (all rights reserved by default).

---
Built as a minimal reference implementation. Feel free to adapt and extend.
