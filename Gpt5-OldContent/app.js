// Azure GPT Mini Chat Frontend Only
// SECURITY NOTE: Calling Azure AI model endpoints directly from the browser exposes your API key to any JS running on the page. Use a restricted key or proxy in production.

const els = {
  settingsPanel: document.getElementById('settings'),
  toggleSettings: document.getElementById('toggle-settings'),
  settingsForm: document.getElementById('settings-form'),
  apiKey: document.getElementById('apiKey'),
  showKey: document.getElementById('showKey'),
  rememberKey: document.getElementById('rememberKey'),
  endpoint: document.getElementById('endpoint'),
  deployment: document.getElementById('deployment'),
  apiVersion: document.getElementById('apiVersion'),
  temperature: document.getElementById('temperature'),
  useResponses: document.getElementById('useResponses'),
  storeSettings: document.getElementById('storeSettings'),
  saveSettings: document.getElementById('saveSettings'),
  clearSettings: document.getElementById('clearSettings'),
  messages: document.getElementById('messages'),
  chatForm: document.getElementById('chat-form'),
  userInput: document.getElementById('user-input'),
  sendBtn: document.getElementById('sendBtn'),
  stopBtn: document.getElementById('stopBtn'),
  clearBtn: document.getElementById('clearBtn'),
  status: document.getElementById('status'),
  usage: document.getElementById('usage')
};

let conversation = [];
let abortController = null;

function loadStored() {
  try {
    const cfgRaw = localStorage.getItem('azureChatSettings');
    if (cfgRaw) {
      const cfg = JSON.parse(cfgRaw);
      ['endpoint','deployment','apiVersion','temperature','useResponses'].forEach(k => {
        if (cfg[k] !== undefined && els[k]) {
          if (k === 'useResponses') els.useResponses.checked = !!cfg[k];
          else els[k].value = cfg[k];
        }
      });
    }
    const savedKey = localStorage.getItem('azureChatApiKey');
    if (savedKey) {
      els.apiKey.value = savedKey;
      els.rememberKey.checked = true;
    }
  } catch (e) { console.warn('Failed loading stored settings', e); }
}

function persistSettings() {
  if (els.storeSettings.checked) {
    const data = {
      endpoint: els.endpoint.value.trim(),
      deployment: els.deployment.value.trim(),
      apiVersion: els.apiVersion.value.trim(),
      temperature: els.temperature.value,
      useResponses: els.useResponses.checked
    };
    localStorage.setItem('azureChatSettings', JSON.stringify(data));
  } else {
    localStorage.removeItem('azureChatSettings');
  }
  if (els.rememberKey.checked) {
    localStorage.setItem('azureChatApiKey', els.apiKey.value);
  } else {
    localStorage.removeItem('azureChatApiKey');
  }
}

function setStatus(text) { els.status.textContent = text; }
function setUsage(text) { els.usage.textContent = text; }

function addMessage(role, content, {streamId} = {}) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.dataset.role = role;
  if (streamId) div.id = streamId;
  div.innerHTML = `<div class="meta">${role}</div><div class="content"></div>`;
  div.querySelector('.content').textContent = content;
  els.messages.appendChild(div);
  els.messages.scrollTop = els.messages.scrollHeight;
  return div;
}

function updateStreamMessage(streamId, delta) {
  const el = document.getElementById(streamId);
  if (!el) return;
  const contentEl = el.querySelector('.content');
  contentEl.textContent += delta;
  els.messages.scrollTop = els.messages.scrollHeight;
}

function replaceStreamMessage(streamId, full) {
  const el = document.getElementById(streamId);
  if (!el) return;
  el.querySelector('.content').textContent = full;
}

function clearConversation() {
  conversation = [];
  els.messages.innerHTML = '';
  setUsage('');
}

function validateConfig() {
  const endpoint = els.endpoint.value.trim().replace(/\/$/, '');
  const deployment = els.deployment.value.trim();
  const apiVersion = els.apiVersion.value.trim();
  const key = els.apiKey.value.trim();
  if (!endpoint || !deployment || !apiVersion || !key) throw new Error('Missing configuration fields');
  return { endpoint, deployment, apiVersion, key };
}

function buildRequestBody(userMessage) {
  const temperature = parseFloat(els.temperature.value) || 0.7;
  const msgs = [...conversation, { role: 'user', content: userMessage }];
  // Azure AI Foundry (OpenAI compatible) responses endpoint structure
  if (els.useResponses.checked) {
    return {
      input: msgs.map(m => ({ role: m.role, content: m.content })),
      model: els.deployment.value.trim(), // some APIs require model or deployment
      temperature,
      stream: true
    };
  }
  // Fallback to chat/completions shape
  return {
    messages: msgs,
    temperature,
    stream: true
  };
}

async function sendMessage(userText) {
  const { endpoint, deployment, apiVersion, key } = validateConfig();
  const useResponses = els.useResponses.checked;
  const path = useResponses
    ? `/openai/deployments/${encodeURIComponent(deployment)}/responses?api-version=${encodeURIComponent(apiVersion)}`
    : `/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  const url = endpoint + path;
  const body = buildRequestBody(userText);

  abortController = new AbortController();
  els.stopBtn.disabled = false;
  els.sendBtn.disabled = true;
  setStatus('Streaming...');

  const streamId = 'stream-' + Date.now();
  addMessage('user', userText);
  const assistantEl = addMessage('assistant', '', { streamId });

  conversation.push({ role: 'user', content: userText });
  let fullContent = '';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': key,
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(body),
      signal: abortController.signal
    });
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Process SSE events line by line
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        if (!rawEvent) continue;
        rawEvent.split(/\n/).forEach(line => handleSSELine(line, { streamId, useResponses }));
      }
    }
    finalizeAssistantMessage(streamId, fullContent);
  } catch (err) {
    if (err.name === 'AbortError') {
      setStatus('Aborted');
    } else {
      console.error(err);
      replaceStreamMessage(streamId, `[Error] ${err.message}`);
      setStatus('Error');
    }
  } finally {
    abortController = null;
    els.stopBtn.disabled = true;
    els.sendBtn.disabled = false;
  }

  function handleSSELine(line, ctx) {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (data === '[DONE]') {
      setStatus('Done');
      return;
    }
    try {
      const json = JSON.parse(data);
      // Responses endpoint streaming format: object.output_text delta OR contents[].text
      if (ctx.useResponses) {
        if (json.type === 'response.output_text.delta') {
          if (json.delta) {
            fullContent += json.delta;
            updateStreamMessage(ctx.streamId, json.delta);
          }
        } else if (json.type === 'response.completed') {
          if (json.usage) setUsage(formatUsage(json.usage));
          finalizeAssistantMessage(ctx.streamId, fullContent);
        } else if (json.type === 'response.error') {
          replaceStreamMessage(ctx.streamId, `[Error] ${json.error?.message || 'Unknown error'}`);
        }
      } else {
        // chat/completions format
        const choice = json.choices?.[0];
        const delta = choice?.delta?.content || choice?.delta?.tool_calls?.[0]?.function?.arguments;
        if (delta) {
          fullContent += delta;
          updateStreamMessage(ctx.streamId, delta);
        }
        if (choice?.finish_reason) {
          if (json.usage) setUsage(formatUsage(json.usage));
          finalizeAssistantMessage(ctx.streamId, fullContent);
        }
      }
    } catch (e) { /* swallow parse errors for partial chunks */ }
  }

  function finalizeAssistantMessage(streamId, content) {
    if (!content) return;
    replaceStreamMessage(streamId, content);
    conversation.push({ role: 'assistant', content });
  }
}

function formatUsage(u) {
  // adapt to potential usage shape
  if (!u) return '';
  const prompt = u.prompt_tokens ?? u.input_tokens ?? '?';
  const completion = u.completion_tokens ?? u.output_tokens ?? '?';
  const total = u.total_tokens ?? (isFinite(prompt) && isFinite(completion) ? prompt + completion : '?');
  return `Usage: prompt ${prompt}, completion ${completion}, total ${total}`;
}

// Event listeners
els.toggleSettings.addEventListener('click', () => {
  const open = els.settingsPanel.hasAttribute('hidden');
  if (open) els.settingsPanel.removeAttribute('hidden'); else els.settingsPanel.setAttribute('hidden','');
  els.toggleSettings.setAttribute('aria-expanded', String(open));
});

els.showKey.addEventListener('change', () => {
  els.apiKey.type = els.showKey.checked ? 'text' : 'password';
});

els.saveSettings.addEventListener('click', () => {
  persistSettings();
  setStatus('Settings saved');
});

els.clearSettings.addEventListener('click', () => {
  localStorage.removeItem('azureChatSettings');
  localStorage.removeItem('azureChatApiKey');
  setStatus('Stored settings cleared');
});

els.chatForm.addEventListener('submit', e => {
  e.preventDefault();
  const text = els.userInput.value.trim();
  if (!text) return;
  els.userInput.value = '';
  sendMessage(text);
});

els.stopBtn.addEventListener('click', () => {
  if (abortController) abortController.abort();
});

els.clearBtn.addEventListener('click', () => {
  clearConversation();
});

// Basic keyboard enhancements
els.userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    els.chatForm.requestSubmit();
  }
});

loadStored();
setStatus('Idle');

// ---------- SSE Parser Self-Test (offline) ----------
// Allows manual invocation in console: window.testSSEParser()
window.testSSEParser = function() {
  const sample = [
    'data: {"type":"response.output_text.delta","delta":"Hello"}\n\n',
    'data: {"type":"response.output_text.delta","delta":", world"}\n\n',
    'data: {"type":"response.completed","usage":{"input_tokens":10,"output_tokens":20,"total_tokens":30}}\n\n'
  ];
  const dummy = addMessage('assistant', '', { streamId: 'test' });
  let full = '';
  sample.forEach(chunk => {
    chunk.trim().split(/\n/).forEach(line => {
      if (!line.startsWith('data:')) return;
      const json = JSON.parse(line.slice(5).trim());
      if (json.type === 'response.output_text.delta') {
        full += json.delta; updateStreamMessage('test', json.delta);
      } else if (json.type === 'response.completed') {
        replaceStreamMessage('test', full);
        setUsage(formatUsage(json.usage));
      }
    });
  });
  return full;
};
