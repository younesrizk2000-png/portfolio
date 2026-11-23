import fs from "fs";
import path from "path";


export default async function handler(req, res) {

  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://younesrizk2000-png.github.io"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );


  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }


  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }


  try {

    const { message, language } = req.body || {};

    const answerLanguage =
      language === "en" ? "English" : language === "fr" ? "French" : "the same language as the question";


    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        error: "A valid message is required."
      });
    }


    if (message.length > 500) {
      return res.status(400).json({
        error: "Message too long."
      });
    }


    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error(
        "OPENROUTER_API_KEY is missing."
      );
    }


    const root = process.cwd();


    const systemPrompt = fs.readFileSync(
      path.join(root, "system-prompt.txt"),
      "utf8"
    );


    const knowledgeBaseRaw = fs.readFileSync(
      path.join(root, "knowledge-base.json"),
      "utf8"
    );


    const knowledgeBase = JSON.parse(
      knowledgeBaseRaw
    );


    const recruiterPrompt = `
PROFESSIONAL KNOWLEDGE BASE

${JSON.stringify(knowledgeBase)}

RECRUITER QUESTION

${message}

ANSWER LANGUAGE: ${answerLanguage}. Write the whole answer in this language.
`;


    // Free models through openrouter/free can be slow or fail now and then:
    // try up to 2 times, with a time limit on each attempt.
    // Free models (openrouter/free) are sometimes saturated (429), slow,
    // or return an empty text when a "reasoning" model runs out of tokens.
    // Up to 3 attempts, a short pause between them, and a global time budget.
    const requestBody = JSON.stringify({
      model: "openrouter/free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: recruiterPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1500,
      reasoning: { effort: "low", exclude: true }
    });

    const startedAt = Date.now();
    const timeBudgetMs = 45000;
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    let answer = "";
    let rateLimited = false;

    for (let attempt = 1; attempt <= 3 && !answer; attempt++) {
      const remaining = timeBudgetMs - (Date.now() - startedAt);
      if (remaining < 5000) {
        break;
      }

      try {
        const openRouterResponse = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://younesrizk2000-png.github.io/portfolio/",
              "X-Title": "Younes Rizk Portfolio Assistant"
            },
            body: requestBody,
            signal: AbortSignal.timeout(Math.min(20000, remaining))
          }
        );

        if (!openRouterResponse.ok) {
          const errorText = (await openRouterResponse.text()).slice(0, 500);
          console.error(
            `OpenRouter error (attempt ${attempt}):`,
            openRouterResponse.status,
            errorText
          );

          // 429 = free quota reached (50 requests per day, 20 per minute).
          // Retrying would only burn more of the quota: stop here.
          if (openRouterResponse.status === 429) {
            rateLimited = true;
            break;
          }

          await wait(800);
          continue;
        }

        const data = await openRouterResponse.json();
        const content = data?.choices?.[0]?.message?.content;

        answer = (
          Array.isArray(content)
            ? content.map((part) => part?.text || "").join("")
            : content || ""
        ).trim();

        if (!answer) {
          console.error(
            `Empty answer (attempt ${attempt}), model: ${data?.model}, finish: ${data?.choices?.[0]?.finish_reason}`
          );
          await wait(500);
        }
      } catch (attemptError) {
        console.error(`OpenRouter attempt ${attempt} failed:`, attemptError?.name || attemptError);
      }
    }

    if (!answer && rateLimited) {
      return res.status(503).json({ error: "rate_limited" });
    }

    if (!answer) {
      throw new Error("No answer returned by OpenRouter after 3 attempts.");
    }


    return res.status(200).json({

      answer,

      badge: "Assistant IA",

      sources: []

    });


  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Assistant unavailable"
    });

  }

}
