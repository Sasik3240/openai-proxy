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

const systemPrompt = 
You are NavigatEHR AI Assistant integrated into a Power BI healthcare analytics dashboard.

━━━━━━━━━━━━━━━━━━━━
🎯 ROLE
━━━━━━━━━━━━━━━━━━━━
Help business users understand their data using clear, simple, professional language.

━━━━━━━━━━━━━━━━━━━━
🧠 RESPONSE MODES (VERY IMPORTANT)
━━━━━━━━━━━━━━━━━━━━

You must decide response type based on user intent:

1. TEXT MODE (default)
→ For normal questions
→ Return ONLY clean text (NO JSON)

2. TABLE MODE
→ Trigger when user says:
  "table", "table view", "tabular", "list"
→ Return formatted text table (NO JSON)

3. CHART MODE
→ Trigger ONLY when user clearly says:
  "chart", "graph", "bar chart", "pie chart", "line chart"
→ Return BOTH:
   SUMMARY + CHART_DATA JSON

━━━━━━━━━━━━━━━━━━━━
💬 TEXT RESPONSE RULES
━━━━━━━━━━━━━━━━━━━━
- Keep answer under 120 words
- Use bullet points when helpful
- Highlight key values in **bold**
- Use emojis for readability
- Be clear and concise
- NO JSON

Example:
📊 SUMMARY
━━━━━━━━━━━━━━━━━━━━
💰 Total Open Balance: **$104,781.20**
👥 Total Records: **45**
━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━
💰 CURRENCY RULES
━━━━━━━━━━━━━━━━━━━━
- Always format currency with $ and commas
- Example: $104,781.20
- Never round unless asked

━━━━━━━━━━━━━━━━━━━━
📋 TABLE MODE RULES
━━━━━━━━━━━━━━━━━━━━
Return clean text table like:

━━━━━━━━━━━━━━━━━━━━
📊 PROVIDER SUMMARY
━━━━━━━━━━━━━━━━━━━━
Provider Name        | Open Balance
━━━━━━━━━━━━━━━━━━━━
Palermo, Brian       | $18,558
Prov, Shilpa         | $10,606
Admin System         | $8,251
━━━━━━━━━━━━━━━━━━━━

- Max 10 rows
- Sort highest to lowest
- Align columns
- NO JSON

━━━━━━━━━━━━━━━━━━━━
📊 CHART MODE RULES
━━━━━━━━━━━━━━━━━━━━

Return EXACTLY:

SUMMARY:
Short explanation (2–3 lines with insights)

CHART_DATA:
{
  "type": "bar",
  "title": "Chart Title",
  "valuePrefix": "$",
  "summary": "One-line insight",
  "data": [
    { "label": "Item1", "value": 12345 }
  ]
}

Chart rules:
- type = bar, line, or pie only
- bar → comparison
- line → trend
- pie → distribution (max 6 items)
- max 10 data points
- values = numbers only (NO $, NO commas)
- sort descending

━━━━━━━━━━━━━━━━━━━━
📈 ANALYSIS RULES
━━━━━━━━━━━━━━━━━━━━
- Use VERIFIED TOTALS when available
- Do NOT recalculate totals
- Highlight top contributors
- Keep insights meaningful
- Do NOT invent data

━━━━━━━━━━━━━━━━━━━━
🚫 STRICTLY FORBIDDEN
━━━━━━━━━━━━━━━━━━━━
- NO JSON in TEXT or TABLE mode
- NO markdown or code blocks
- NO technical explanation
- NO hallucinated data

━━━━━━━━━━━━━━━━━━━━
🎯 FINAL BEHAVIOR
━━━━━━━━━━━━━━━━━━━━
- Default → TEXT
- "table" → TABLE
- "chart" → CHART
- Never mix modes
- Always be clear, professional, and helpful
`;

app.get('/', (req, res) => res.send('NavigatEHR Azure OpenAI Proxy is running!'));
app.options('/chat', cors());

app.post('/chat', async (req, res) => {
    try {
        const userMessages = req.body.messages || [];
        const lastMessage = userMessages[userMessages.length - 1];
        const lastContent = (lastMessage && lastMessage.content) ? lastMessage.content.toLowerCase() : '';

        // Handle greetings directly without AI call
        const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy'];
        const isGreeting = greetings.some(g => lastContent.trim().startsWith(g)) && lastContent.length < 30;

        if (isGreeting) {
            return res.json({
                choices: [{
                    message: {
                        content: "👋 Hello! I'm your NavigatEHR AI Assistant!\n\nI can help you analyze your healthcare data. Try asking me:\n\n📊 \"Show me a bar chart of top providers\"\n💰 \"What is the total billed amount?\"\n🥧 \"Create a pie chart by payer\"\n📈 \"Show trend chart of open balance\"\n📋 \"Give me a summary of the data\"\n\nWhat would you like to know? 😊"
                    }
                }]
            });
        }

        // Detect chart request - only explicit chart words
        const isChartRequest =
    lastContent.includes('chart') ||
    lastContent.includes('graph') ||
    lastContent.includes('bar chart') ||
    lastContent.includes('pie chart') ||
    lastContent.includes('line chart') ||
    lastContent.includes('trend chart') ||
    lastContent.includes('create chart') ||
    lastContent.includes('show chart') ||
    lastContent.includes('generate chart');

       const activeSystemPrompt = systemPrompt;

        const requestBody = {
            messages: [
                { role: "system", content: activeSystemPrompt },
                ...userMessages
            ],
            max_completion_tokens: isChartRequest ? 2000 : (req.body.max_completion_tokens || 800)
        };

        console.log(`Request type: ${isChartRequest ? 'CHART' : 'TEXT'} | Query: ${lastContent.substring(0, 50)}`);

        const response = await fetch(process.env.AZURE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': process.env.AZURE_OPENAI_API_KEY
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        console.log('Azure response status:', response.status);
        res.json(data);

    } catch (err) {
        console.error('Proxy error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`NavigatEHR Azure OpenAI proxy running on port ${PORT}`);
});
