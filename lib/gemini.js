import { SHLOKA_INDEX } from "@/lib/shlokas";

const DEFAULT_MODEL = "gemini-2.5-flash-preview-05-20";

function extractJson(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Gemini did not return valid JSON.");
    }

    return JSON.parse(match[0]);
  }
}

async function callGemini(prompt, { maxOutputTokens = 500, temperature = 0.35 } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message || `Gemini request failed with ${response.status}.`;
    throw new Error(message);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return extractJson(text);
}

export async function pickShlokaId(problem) {
  const prompt = `You are selecting one Bhagavad Gita shloka for a user's life problem.

User problem:
"${problem}"

Available shlokas:
${JSON.stringify(SHLOKA_INDEX)}

Rules:
- Return JSON only in this exact shape: {"id":"chapter.verse"}.
- Choose exactly one id from the available shlokas.
- Do not write Sanskrit, meanings, or advice.
- Match the user's lived situation, not just literal keywords.`;

  const parsed = await callGemini(prompt, {
    maxOutputTokens: 80,
    temperature: 0.15,
  });

  if (!parsed?.id || !SHLOKA_INDEX.some((shloka) => shloka.id === parsed.id)) {
    throw new Error("Gemini returned an unknown shloka id.");
  }

  return parsed.id;
}

export async function writePersonalGuidance(problem, shloka) {
  const prompt = `You are Gita Marg, a warm Bhagavad Gita life coach.

User problem:
"${problem}"

Matched shloka from the local source of truth:
Chapter ${shloka.chapter}, Verse ${shloka.verse}
Sanskrit: ${shloka.sanskrit}
Transliteration: ${shloka.transliteration}
English meaning: ${shloka.meaning_english}

Rules:
- Return JSON only in this exact shape: {"advice":"..."}.
- Write 2-4 short paragraphs separated by blank lines.
- Follow three beats: honour the feeling, bring this verse to bear, offer one concrete action for today.
- Apply this specific shloka to this exact person's problem.
- Do not invent Sanskrit text or extra verse references.
- Avoid sounding clinical, generic, preachy, saccharine, or like a therapist.
- Prefer: guidance, shlok, path, dilemma, reflect, seek guidance, meaning.
- Avoid: journey, voyage, soul-searching, vibes, energy, AI-powered, leverage, unlock, click here, tap below, sorry to hear that.`;

  const parsed = await callGemini(prompt, {
    maxOutputTokens: 520,
    temperature: 0.45,
  });

  if (!parsed?.advice || typeof parsed.advice !== "string") {
    throw new Error("Gemini did not return advice.");
  }

  return parsed.advice.trim();
}
