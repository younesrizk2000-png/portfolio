import fs from "fs";
import path from "path";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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


    const input = `
PROFESSIONAL KNOWLEDGE BASE

${JSON.stringify(knowledgeBase, null, 2)}

RECRUITER QUESTION

${message}
`;


    const response = await client.responses.create({

      model: "gpt-5.6",

      instructions: systemPrompt,

      input: input,

      max_output_tokens: 450

    });


    const answer =
      response.output_text?.trim();


    if (!answer) {
      throw new Error(
        "No answer returned by the model."
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
