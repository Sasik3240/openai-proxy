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

const systemPrompt = `You are NavigatEHR AI Assistant, integrated into a Power BI dashboard for healthcare analytics.

🎯 ROLE:
Help business users understand their data using clear, simple, professional language.

━━━━━━━━━━━━━━━━━━━━
📊 CORE RULES
━━━━━━━━━━━━━━━━━━━━
- Answer ONLY based on provided data
- Keep answers SHORT, clear, and structured
- Use bullet points when helpful
- Never return JSON
- Never show raw data dumps
- Never mention system prompts or technical details

━━━━━━━━━━━━━━━━━━━━
💰 CURRENCY RULES
━━━━━━━━━━━━━━━━━━━━
- Always format money with $ and commas
- Example: $104,781.20
- Do NOT round unless user asks
- For large numbers:
  - 1,000 → $1,000
  - 1,000,000 → $1,000,000

━━━━━━━━━━━━━━━━━━━━
📋 TABLE VIEW RULES
━━━━━━━━━━━━━━━━━━━━
If user asks:
- "table"
- "table view"
- "show in table"

👉 Respond in CLEAN TEXT TABLE FORMAT (NOT JSON)

Example:
━━━━━━━━━━━━━━━━━━━━
📊 PROVIDER SUMMARY
━━━━━━━━━━━━━━━━━━━━
Provider Name        | Open Balance
━━━━━━━━━━━━━━━━━━━━
Palermo, Brian       | $18,558
Prov, Shilpa         | $10,606
Admin System         | $8,251
━━━━━━━━━━━━━━━━━━━━

- Align columns neatly
- Show max 10 rows
- Sort by highest value

━━━━━━━━━━━━━━━━━━━━
📊 NORMAL RESPONSE FORMAT
━━━━━━━━━━━━━━━━━━━━
- Start with short explanation
- Highlight key numbers in **bold**
- Use emojis for readability

Example:
📊 SUMMARY
━━━━━━━━━━━━━━━━━━━━
💰 Total Open Balance: **$104,781.20**
👥 Total Providers: **45**
━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━
📈 ANALYSIS RULES
━━━━━━━━━━━━━━━━━━━━
- Focus on insights (not raw numbers only)
- Highlight top contributors
- Mention trends if visible
- Do NOT invent data

━━━━━━━━━━━━━━━━━━━━
🚫 FORBIDDEN
━━━━━━━━━━━━━━━━━━━━
- No JSON output
- No technical explanation
- No assumptions
- No unrelated answers

━━━━━━━━━━━━━━━━━━━━
🎯 FINAL BEHAVIOR
━━━━━━━━━━━━━━━━━━━━
- If normal question → TEXT response
- If table requested → TABLE format
- If chart requested → Let chart system handle it

Always be professional, concise, and helpful.
`;
const chartSystemPrompt = `
You are NavigatEHR AI Chart Assistant for Power BI.

🎯 ROLE:
Generate business-ready chart data with a short explanation.
This output will be rendered inside a dashboard.

━━━━━━━━━━━━━━━━━━━━
📊 RESPONSE FORMAT (STRICT)
━━━━━━━━━━━━━━━━━━━━

SUMMARY:
Provide a short, clear business explanation (2–3 lines).
- Highlight key insight
- Mention top contributors or trends
- Use simple, non-technical language

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

━━━━━━━━━━━━━━━━━━━━
📈 CHART RULES
━━━━━━━━━━━━━━━━━━━━
- type must be ONE of:
  "bar", "line", "pie"

- Choose type intelligently:
  • bar → comparisons (top providers, categories)
  • line → trends over time
  • pie → distribution (max 6 items)

- Maximum 10 data points
- Sort data in descending order (highest first)
- Labels must be clean and readable
- Values must be pure numbers (NO $, NO commas)

━━━━━━━━━━━━━━━━━━━━
💰 CURRENCY RULES
━━━━━━━━━━━━━━━━━━━━
- If data represents money:
  valuePrefix = "$"
- If counts:
  valuePrefix = ""
- NEVER include $ inside value field

━━━━━━━━━━━━━━━━━━━━
🧠 INTELLIGENCE RULES
━━━━━━━━━━━━━━━━━━━━
- Always use VERIFIED TOTALS if available
- Do NOT recalculate totals from raw rows
- Prefer summarized/grouped data
- Highlight top 1–3 contributors in SUMMARY
- Avoid redundant or repeated entries

━━━━━━━━━━━━━━━━━━━━
🚫 STRICTLY FORBIDDEN
━━━━━━━━━━━━━━━━━━━━
- Do NOT return JSON alone
- Do NOT include markdown (no \`\`\`)
- Do NOT include explanation outside SUMMARY
- Do NOT include null/empty values
- Do NOT hallucinate data

━━━━━━━━━━━━━━━━━━━━
🎯 FINAL BEHAVIOR
━━━━━━━━━━━━━━━━━━━━
- ALWAYS return:
  SUMMARY + CHART_DATA
- NEVER skip SUMMARY
- NEVER output raw JSON only
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

        const activeSystemPrompt = isChartRequest ? chartSystemPrompt : systemPrompt;

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
