export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método não permitido." });
  }

  const body = req.body || {};
  const providerRequested = String(body.provider || "gemini").toLowerCase();
  const prompt = String(body.prompt || "").trim();
  const systemInstruction = String(body.systemInstruction || "").trim();
  const context = Array.isArray(body.context) ? body.context : [];

  if (!prompt) {
    return res.status(400).json({ ok: false, error: "Prompt vazio." });
  }

  function normalizeContext(items = []) {
    return items
      .filter((item) => item && (item.content || item.text))
      .map((item) => ({
        role: item.role || "system",
        content: String(item.content || item.text || "").trim()
      }))
      .filter((item) => item.content);
  }

  function buildPrompt() {
    const normalized = normalizeContext(context);
    const parts = [];

    if (systemInstruction) {
      parts.push(`Instruções do sistema:\n${systemInstruction}`);
    }

    if (normalized.length) {
      parts.push(
        "Contexto adicional:\n" +
          normalized.map((item) => `- ${item.role}: ${item.content}`).join("\n")
      );
    }

    parts.push(`Pergunta do usuário:\n${prompt}`);
    parts.push("Responda de forma objetiva. Não invente informações. Se não souber, diga claramente.");

    return parts.join("\n\n");
  }

  async function callGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    const geminiModel = process.env.GEMINI_MODEL || body.model || "gemini-2.5-flash";

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY ausente.");
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: buildPrompt() }]
            }
          ],
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 700,
            topP: 0.9,
            topK: 20
          }
        })
      }
    );

    const raw = await response.text();
    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(raw || "Resposta inválida do Gemini.");
    }

    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || "Falha ao chamar o Gemini.");
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("\n").trim() || "";

    if (!text) {
      throw new Error("Gemini retornou resposta vazia.");
    }

    return {
      ok: true,
      provider: "gemini",
      model: geminiModel,
      text
    };
  }

  async function callMistral() {
    const apiKey = process.env.MISTRAL_API_KEY;
    const model = body.model || "mistral-small-latest";

    if (!apiKey) {
      throw new Error("MISTRAL_API_KEY ausente.");
    }

    const normalized = normalizeContext(context);
    const messages = [];

    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }

    normalized.forEach((item) => {
      messages.push({
        role: item.role || "system",
        content: item.content
      });
    });

    messages.push({
      role: "user",
      content: `${prompt}\n\nNão invente informações. Se não souber, diga claramente.`
    });

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.25,
        max_tokens: 700
      })
    });

    const raw = await response.text();
    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(raw || "Resposta inválida do Mistral.");
    }

    if (!response.ok) {
      throw new Error(data?.message || data?.error?.message || "Falha ao chamar o Mistral.");
    }

    const text = data?.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      throw new Error("Mistral retornou resposta vazia.");
    }

    return {
      ok: true,
      provider: "mistral",
      model,
      text
    };
  }

  try {
    let result;

    if (providerRequested === "mistral") {
      result = await callMistral();
    } else {
      try {
        result = await callGemini();
      } catch (geminiError) {
        console.error("[ai-chat] Gemini falhou, tentando Mistral:", geminiError?.message || geminiError);
        result = await callMistral();
        result.fallbackFrom = "gemini";
        result.notice = geminiError?.message || "Gemini indisponível.";
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("[ai-chat] Erro:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro interno na IA."
    });
  }
}
