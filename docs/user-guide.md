# NextAssist User Guide

## Getting Started

NextAssist is an AI chatbot assistant integrated into your Frappe site. Access it at `/nextassist` from your browser.

**Requirements**: You must have the **System Manager** role to access NextAssist.

After logging in, you'll see the main navigation sidebar with these sections:
- **Chat** — Start and continue AI conversations
- **Sessions** — View and manage chat history
- **Schedulers** — Set up recurring automated tasks
- **Providers** — Configure AI provider integrations
- **Settings** — Application-wide settings

---

## Setting Up AI Providers

Before you can use the chat, you need to configure at least one AI provider.

### Adding a New Provider

1. Navigate to **Providers** from the sidebar
2. Click **New Provider**
3. Fill in the required fields:

| Field | Description |
|-------|-------------|
| **Provider Name** | A unique name for this provider (e.g., "my-openai") |
| **Provider Type** | Choose: OpenAI, Anthropic, or Google |
| **API Key** | Your provider's API key (stored encrypted) |

4. Optionally configure:
   - **API Base URL** — Override the default endpoint (useful for proxies)
   - **Organization ID** — Required for some OpenAI accounts
   - **Default Model** — Select from the dropdown based on provider type
   - **Max Tokens** — Maximum tokens per response (default: 4096)
   - **Temperature** — Controls response randomness, 0-2 (default: 0.7)
   - **Max Context Messages** — How many previous messages to include as context (default: 20)

5. Toggle **Enabled** to activate the provider
6. Toggle **Default Provider** if this should be the default for new chats
7. Click **Create**

### Supported Models

**OpenAI**: gpt-5.4-pro, gpt-5.4, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-4o, gpt-4o-mini, o4-mini, o3, o3-mini

**Anthropic**: claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5, claude-opus-4-20250514, claude-sonnet-4-20250514, claude-haiku-4-5-20251001

**Google**: gemini-3.1-pro-preview, gemini-3.1-flash-lite-preview, gemini-3-flash-preview, gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.0-flash, gemini-2.0-flash-lite

### Managing Providers

- **Edit**: Click a provider from the list to update its settings
- **View/Copy API Key**: Use the eye icon to show/hide the key, and the copy icon to copy it
- **Delete**: Click the Delete button on the provider's detail page
- **Usage Stats**: The sidebar on each provider page shows tokens burned, active sessions, and recent session activity

---

## Application Settings

Navigate to **Settings** from the sidebar to configure app-wide options:

| Setting | Description |
|---------|-------------|
| **Default Provider** | Which AI provider to use for new chats |
| **Enable Tool Calling** | Allow the AI to call tools (query data, create records, etc.) |
| **Enable File Uploads** | Allow users to attach files to chat messages |

The provider's model configuration (model, max tokens, temperature, context messages) is shown as read-only for reference.

---

## Chat

### Starting a Conversation

1. Navigate to **Chat** from the sidebar
2. Click **New Chat** to start a fresh conversation
3. Type your message in the input box at the bottom
4. Press **Enter** to send (or **Shift+Enter** for a new line)

### Switching Models

Click the **model badge** above the message input to open the model switcher. You can change the AI model mid-conversation — models are grouped by provider type.

### AI Responses

The AI streams its response in real-time. Responses can include:

- **Text** — Rendered as formatted markdown with support for headings, bold, italic, links, and code blocks
- **Tables** — Data displayed in scrollable, formatted tables
- **Charts** — Bar, line, pie, and percentage charts rendered inline
- **Lists** — Structured data displayed as interactive lists
- **Bullet Points** — Key-value summaries
- **Files** — Images shown as thumbnails, other files as downloadable links
- **Code** — Python code blocks can be toggled visible with the "Show code" button

### File Uploads

When file uploads are enabled in Settings, you can attach files to your messages. Supported file types include PDFs, images, and text files. The AI can read and analyze the file content.

### Token Limits

Each conversation tracks token usage against the model's context window:
- At **80% usage**, you'll see a warning banner
- At **100%**, the session is marked "Limit Reached" and you'll be prompted to start a new chat
- Token counts are visible in the chat header

---

## Sessions

Navigate to **Sessions** from the sidebar to view all chat sessions.

### Session List

The list shows:
- **Title** — Auto-generated from the first message
- **User** — Who created the session
- **Status** — Active (green), Limit Reached (yellow), or Archived (gray)
- **Provider & Model** — Which AI was used
- **Total Tokens** — Cumulative token usage
- **Last Message** — When the last message was sent

Use the **search bar** to find sessions by title, and **filters** to narrow by status.

### Viewing Session Details

Click a session to see its details:
- Session metadata (title, user, status, tokens, provider, model)
- Message list with role indicators and timestamps

### View Chat (Preview)

Click the **View Chat** button to open a full-screen preview modal that renders the conversation exactly as it appeared in the chat — including:
- Formatted markdown text
- Charts and tables
- Error messages with styling
- Code blocks with toggle

The preview uses a three-column layout:
- **Left sidebar** — Session details and statistics
- **Center** — Chat messages with full rendering
- **Right sidebar** — Message timeline with role indicators and timestamps

### Quick Actions

- **View Chat** — Opens the conversation preview modal
- **Open in Chat** — Navigate to the live chat to continue the conversation
- **Delete** — Permanently remove the session and all its messages

---

## Schedulers

Schedulers let you create recurring automated tasks that run on a cron schedule.

### Creating a Scheduler

1. Navigate to **Schedulers** from the sidebar
2. Click **New Scheduler**
3. Configure:

| Field | Description |
|-------|-------------|
| **Title** | A descriptive name for the task |
| **Cron Expression** | Schedule in cron format (e.g., `0 9 * * *` for daily at 9 AM) |
| **Query DocType** | The Frappe DocType to query |
| **Query Filters** | JSON filters to match records |
| **Query Fields** | Which fields to retrieve |
| **Query Condition** | Optional SQL-like condition |
| **Action Type** | What to do with matched records |

### Action Types

| Type | Description |
|------|-------------|
| **Email** | Send an email with the matched data |
| **Notification** | Create a Frappe notification |
| **Webhook** | POST the data to an external URL |
| **Custom Code** | Execute custom Python code |

### Managing Schedulers

- **Enable/Disable** — Toggle the scheduler on or off
- **Status** — Active, Paused, Error, or Completed
- **Run History** — View past executions with status, duration, matched/actioned counts
- **Error Tracking** — See the last error message and error count

Schedulers are checked every minute by the background dispatcher.

---

## Provider Usage

Each provider's detail page includes a **Usage Stats** sidebar showing:

- **Tokens Burned** — Total tokens used across all sessions with this provider
- **Active Sessions** — Number of currently active sessions
- **Total Sessions** — All sessions that have used this provider
- **Last Used** — When the provider was last used

Below the stats, a **Recent Sessions** list shows the latest sessions with:
- Status indicator (green = Active, yellow = Limit Reached, gray = Archived)
- Session title (clickable to open in chat)
- User, token count, and relative time

---

## Tips

- **Dark Mode**: Toggle between Light, Dark, and System themes using the theme switcher at the bottom of the sidebar
- **Keyboard Shortcuts**: Press Enter to send a message, Shift+Enter for a new line
- **Context Window**: Start a new chat when you hit the token limit for best results — the AI's response quality degrades as the context fills up
- **Multiple Providers**: You can configure multiple providers and switch between them via Settings or the model switcher
