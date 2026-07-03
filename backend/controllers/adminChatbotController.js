const { GoogleGenAI, Type } = require("@google/genai");
const adminChatbotTools = require("../services/adminChatbotTools");

const MODEL = "gemini-2.5-flash";

const safeFunctions = Object.freeze({
  getRequestStats: adminChatbotTools.getRequestStats,
  getEmployeesCount: adminChatbotTools.getEmployeesCount,
  getDatabaseSchema: adminChatbotTools.getDatabaseSchema,
  runSafeSelectQuery: adminChatbotTools.runSafeSelectQuery,
});

const functionDeclarations = [
  {
    name: "getRequestStats",
    description:
      "Get request statistics grouped by request type and status.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "getEmployeesCount",
    description: "Get the number of active users with the Employee role.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "getDatabaseSchema",
    description:
      "Get the database tables and columns that the chatbot is allowed to use.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "runSafeSelectQuery",
    description:
      "Run a safe SELECT-only SQL Server query against the database. Use this only after checking the schema.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description:
            "A SELECT-only SQL Server query. Never use INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, EXEC, passwords, or tokens.",
        },
      },
      required: ["query"],
    },
  },
];

function getUserMessage(req) {
  return req.body?.message || req.body?.question || req.body?.prompt || "";
}

function getHistory(req) {
  const history = req.body?.history;
  return Array.isArray(history) ? history : [];
}

function mapHistoryToContents(history) {
  return history
    .map((item) => {
      const role = item?.role;
      const text = typeof item?.text === "string" ? item.text.trim() : "";
      if (!text) return null;

      const mappedRole =
        role === "user" ? "user" : role === "assistant" ? "model" : null;

      if (!mappedRole) return null;

      return {
        role: mappedRole,
        parts: [{ text }],
      };
    })
    .filter(Boolean);
}

function getResponseText(response) {
  if (typeof response.text === "string") return response.text;
  if (typeof response.text === "function") return response.text();

  const parts = response.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();
}

function getFirstFunctionCall(response) {
  if (Array.isArray(response.functionCalls) && response.functionCalls.length > 0) {
    return response.functionCalls[0];
  }

  const parts = response.candidates?.[0]?.content?.parts || [];
  return parts.find((part) => part.functionCall)?.functionCall || null;
}

async function askAdminChatbot(req, res) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const message = getUserMessage(req).trim();
    const history = getHistory(req);

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
    }

    if (!message) {
      return res.status(400).json({ error: "A message is required." });
    }

    const ai = new GoogleGenAI({ apiKey });

    const contents = [
      ...mapHistoryToContents(history),
      { role: "user", parts: [{ text: message }] },
    ];

    const firstResponse = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction:
          "You are an admin chatbot for CheckPoint. You can answer questions about the database using safe SELECT-only queries. When database facts are needed, first use getDatabaseSchema to understand available tables and columns, then use runSafeSelectQuery. Never expose passwords, password hashes, tokens, refresh tokens, reset tokens, or authentication secrets. Never use INSERT, UPDATE, DELETE, MERGE, DROP, ALTER, CREATE, TRUNCATE, EXEC, or EXECUTE. Keep answers short, clear, and professional.",
        tools: [{ functionDeclarations }],
      },
    });

    const functionCall = getFirstFunctionCall(firstResponse);

    if (!functionCall) {
      return res.json({ answer: getResponseText(firstResponse) });
    }

    const tool = safeFunctions[functionCall.name];

    if (!tool) {
      return res.status(400).json({ error: "Requested function is not allowed." });
    }

    const databaseResult = await tool(functionCall.args || {});

    const finalResponse = await ai.models.generateContent({
      model: MODEL,
      contents: [
        ...contents,
        {
          role: "model",
          parts: [{ functionCall }],
        },
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: functionCall.name,
                response: {
                  result: databaseResult,
                },
              },
            },
          ],
        },
      ],
      config: {
        systemInstruction:
          "Use the database result to answer the admin's question. Be concise, factual, and clear. Do not mention raw SQL, tool names, or implementation details unless necessary.",
      },
    });

    return res.json({
      answer: getResponseText(finalResponse),
      data: databaseResult,
    });
  } catch (error) {
    console.error("Admin chatbot error:", error);

    return res.status(500).json({
      error: "Failed to process admin chatbot request.",
    });
  }
}

module.exports = {
  askAdminChatbot,
};