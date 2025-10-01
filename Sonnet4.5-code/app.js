// Configuration storage
let config = {
    apiKey: '',
    endpoint: '',
    deploymentName: '',
    systemPrompt: 'You are a helpful AI assistant. Provide clear, accurate, and friendly responses.'
};

// Load config from localStorage
function loadConfig() {
    const saved = localStorage.getItem('azureAIConfig');
    if (saved) {
        config = JSON.parse(saved);
        enableChat();
    }
}

// Save config to localStorage
function saveConfig() {
    localStorage.setItem('azureAIConfig', JSON.stringify(config));
}

// DOM Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const saveSettingsBtn = document.getElementById('saveSettings');
const closeSettingsBtn = document.getElementById('closeSettings');
const apiKeyInput = document.getElementById('apiKey');
const endpointInput = document.getElementById('endpoint');
const deploymentNameInput = document.getElementById('deploymentName');
const systemPromptInput = document.getElementById('systemPrompt');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');

// Conversation history
let conversationHistory = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    setupEventListeners();
    
    // Populate form with saved values
    if (config.apiKey) apiKeyInput.value = config.apiKey;
    if (config.endpoint) endpointInput.value = config.endpoint;
    if (config.deploymentName) deploymentNameInput.value = config.deploymentName;
    if (config.systemPrompt) systemPromptInput.value = config.systemPrompt;
});

function setupEventListeners() {
    // Settings modal
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('active');
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('active');
    });

    saveSettingsBtn.addEventListener('click', () => {
        config.apiKey = apiKeyInput.value.trim();
        config.endpoint = endpointInput.value.trim();
        config.deploymentName = deploymentNameInput.value.trim();
        config.systemPrompt = systemPromptInput.value.trim() || 'You are a helpful AI assistant.';

        if (!config.apiKey || !config.endpoint || !config.deploymentName) {
            alert('Please fill in all required fields (API Key, Endpoint, and Deployment Name)');
            return;
        }

        saveConfig();
        enableChat();
        settingsModal.classList.remove('active');
        
        // Reset conversation history with new system prompt
        conversationHistory = [];
        
        // Clear welcome message if exists
        const welcomeMsg = document.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }
        
        addMessage('assistant', 'Configuration saved! You can start chatting now. How can I help you today?');
    });

    // Close modal on outside click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('active');
        }
    });

    // Send message
    sendBtn.addEventListener('click', sendMessage);
    
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
    });
}

function enableChat() {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.placeholder = 'Type your message here...';
}

function addMessage(role, content, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isError ? 'error' : role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message assistant';
    indicator.id = 'typing-indicator';
    
    const typing = document.createElement('div');
    typing.className = 'typing-indicator';
    typing.innerHTML = '<span></span><span></span><span></span>';
    
    indicator.appendChild(typing);
    chatMessages.appendChild(indicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Add user message
    addMessage('user', message);
    conversationHistory.push({ role: 'user', content: message });

    // Clear input
    userInput.value = '';
    userInput.style.height = 'auto';

    // Disable input while processing
    userInput.disabled = true;
    sendBtn.disabled = true;

    // Show typing indicator
    addTypingIndicator();

    try {
        await streamChatCompletion(message);
    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();
        addMessage('assistant', `Error: ${error.message}`, true);
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}

async function streamChatCompletion(userMessage) {
    // Construct the API URL
    const apiVersion = '2024-02-15-preview';
    const url = `${config.endpoint}/openai/deployments/${config.deploymentName}/chat/completions?api-version=${apiVersion}`;

    // Build messages array with system prompt (with fallback)
    const systemPrompt = config.systemPrompt || 'You are a helpful AI assistant. Provide clear, accurate, and friendly responses.';
    const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory
    ];

    const requestBody = {
        messages: messages,
        max_completion_tokens: 2000,
        stream: true
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': config.apiKey
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    // Remove typing indicator
    removeTypingIndicator();

    // Create message element for streaming
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);

    let fullResponse = '';

    // Read the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.substring(6);
                
                if (data === '[DONE]') {
                    break;
                }

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices[0]?.delta?.content;
                    
                    if (content) {
                        fullResponse += content;
                        contentDiv.textContent = fullResponse;
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                } catch (e) {
                    // Skip invalid JSON lines
                    continue;
                }
            }
        }
    }

    // Add to conversation history
    conversationHistory.push({ role: 'assistant', content: fullResponse });
}
