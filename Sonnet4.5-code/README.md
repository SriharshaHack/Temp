# Azure AI Foundry Chat Application

A simple, elegant chat interface that connects directly to Azure AI Foundry (formerly Azure OpenAI Service) from the browser with streaming responses.

## Features

- 🔐 Secure API key input (stored locally in browser)
- 💬 Real-time streaming responses
- 🎨 Modern, responsive UI
- 📱 Mobile-friendly design
- 💾 Conversation history maintained during session
- ⚡ No backend required - direct browser to Azure AI Foundry

## Setup

### 1. Get Azure AI Foundry Credentials

You'll need:
- **API Key**: Your Azure AI Foundry API key
- **Endpoint URL**: Your Azure endpoint (e.g., `https://your-resource.openai.azure.com`)
- **Deployment Name**: The name of your GPT model deployment (e.g., `gpt-4`, `gpt-35-turbo`)

### 2. Run the Application

Simply open `index.html` in a web browser:

```bash
# Option 1: Open directly
open index.html

# Option 2: Use a local server (recommended)
python -m http.server 8000
# Then visit http://localhost:8000

# Option 3: Use Node.js http-server
npx http-server
```

### 3. Configure API Settings

1. Click the **⚙️ Settings** button
2. Enter your Azure AI Foundry credentials:
   - API Key
   - Endpoint URL
   - Deployment Name
3. Click **Save Settings**
4. Start chatting!

## Usage

- Type your message in the input field at the bottom
- Press **Enter** or click the send button
- The AI will stream its response in real-time
- Your settings are saved in browser's localStorage

## Security Notes

⚠️ **Important**: 
- This application stores your API key in browser localStorage
- API calls are made directly from the browser
- Your API key is exposed in browser network requests
- For production use, implement a backend proxy to protect your API key

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Any modern browser with ES6+ support

## Technologies Used

- Pure HTML5
- CSS3 with modern features (Grid, Flexbox, Animations)
- Vanilla JavaScript (ES6+)
- Fetch API with streaming support

## CORS Configuration

If you encounter CORS errors, you may need to configure your Azure AI Foundry resource to allow requests from your domain. Alternatively, use a backend proxy in production.

## License

MIT License - Feel free to use and modify as needed.
