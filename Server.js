const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ FIXED SYSTEM PROMPT (STRING FORMAT CORRECT)
const systemPrompt = `
You are NavigatEHR AI Assistant integrated into a Power BI healthcare analytics dashboard.

🎯 ROLE:
Help users understand data in simple business language.

━━━━━━━━━━━━━━━━━━━━
🧠 RESPONSE MODES
━━━━━━━━━━━━━━━━━━━━
1. TEXT → Normal questions → TEXT ONLY
2. TABLE → "table", "table view" → TEXT TABLE
3. CHART → "chart", "graph" → SUMMARY + CHART_DATA

━━━━━━━━━━━━━━━━━━━━
💬 TEXT RULES
━━━━━━━━━━━━━━━━━━━━
- Keep answers short
- Use bullet points
- Highlight key values
- NO JSON

Example:
📊 SUMMARY
━━━━━━━━━━━━━━━━━━━━
💰 Total Open Balance: **$104,781.20**
━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━
💰 CURRENCY RULES
━━━━━━━━━━━━━━━━━━━━
- Always use $ and commas
- Example: $104,781.20

━━━━━━━━━━━━━━━━━━━━
📋 TABLE RULES
━━━━━━━━━━━━━━━━━━━━
Return:

━━━━━━━━━━━━━━━━━━━━
Provider Name        | Open Balance
━━━━━━━━━━━━━━━━━━━━
Palermo, Brian       | $18,558
━━━━━━━━━━━━━━━━━━━━

- Max 10 rows
- Sorted descending
- NO JSON

━━━━━━━━━━━━━━━━━━━━
📊 CHART RULES
━━━━━━━━━━━━━━━━━━━━
Return:

SUMMARY:
Short explanation

CHART_DATA:
{
  "type": "bar",
  "title": "Chart Title",
  "valuePrefix": "$",
  "summary": "Insight",
  "data": [
    { "label": "Item1", "value": 12345 }
  ]
}

- type: bar | line | pie
- values: numbers only
- max 10 items

━━━━━━━━━━━━━━━━━━━━
🚫 FORBIDDEN
━━━━━━━━━━━━━━━━━━━━
- No JSON in TEXT/TABLE
- No markdown
- No fake data
`;

app.get('/', (req, res) => res.send('NavigatEHR Azure OpenAI Proxy is running!'));
app.options('/chat', cors());

app.post('/chat', async (req, res) => {
    try {
        const userMessages = req.body.messages || [];
        const lastMessage = userMessages[userMessages.length - 1];
        const lastContent = (lastMessage?.content || '').toLowerCase();

        // ✅ GREETING HANDLER
        const greetings = ['hello', 'hi', 'hey'];
        const isGreeting = greetings.some(g => lastContent.startsWith(g));

        if (isGreeting) {
            return res.json({
                choices: [{
                    message: {
                        content: "👋 Hello! Ask me about your data or request a chart 📊"
                    }
                }]
            });
        }

        // ✅ ONLY FOR TOKEN LIMIT (NOT PROMPT SWITCHING)
        const isChartRequest = /\b(chart|graph)\b/.test(lastContent);

        const requestBody = {
            messages: [
                { role: "system", content: systemPrompt },
                ...userMessages
            ],
            max_completion_tokens: isChartRequest ? 2000 : 800
        };

        console.log(`Mode: ${isChartRequest ? 'CHART' : 'TEXT'} | Query: ${lastContent}`);

        const response = await fetch(process.env.AZURE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': process.env.AZURE_OPENAI_API_KEY
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        res.json(data);

    } catch (err) {
        console.error('Proxy error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
