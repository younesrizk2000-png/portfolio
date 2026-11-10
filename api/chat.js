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

    const { message } = req.body || {};


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

${JSON.stringify(knowledgeBase, null, 2)}

RECRUITER QUESTION

${message}
`;


    const openRouterResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Authorization":
            `Bearer ${process.env.OPENROUTER_API_KEY}`,

          "Content-Type":
            "application/json",

          "HTTP-Referer":
            "https://younesrizk2000-png.github.io/portfolio/",

          "X-Title":
            "Younes Rizk Portfolio Assistant"
        },

        body: JSON.stringify({

          model: "openrouter/free",

          messages: [

            {
              role: "system",
              content: systemPrompt
            },

            {
              role: "user",
              content: recruiterPrompt
            }

          ],

          temperature: 0.3,

          max_tokens: 450

        })
      }
    );


    if (!openRouterResponse.ok) {

      const errorText =
        await openRouterResponse.text();

      console.error(
        "OpenRouter error:",
        openRouterResponse.status,
        errorText
      );

      throw new Error(
        "OpenRouter request failed."
      );
    }


    const data =
      await openRouterResponse.json();


    const answer =
      data?.choices?.[0]?.message?.content?.trim();


    if (!answer) {

      throw new Error(
        "No answer returned by OpenRouter."
      );

    }


    return res.status(200).json({

      answer: answer,

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
