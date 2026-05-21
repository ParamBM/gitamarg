import { SHLOKA_INDEX } from "@/lib/shlokas";

const DEFAULT_MODEL = "gemini-3.5-flash";

const FALLBACK_KEYWORDS = {
  anxiety: ["anxious", "anxiety", "overthinking", "stress", "restless", "panic"],
  burnout: ["burnout", "overwhelmed", "exhausted", "tired", "hopeless", "giving up"],
  career: ["career", "job", "work", "business", "startup", "interview", "exam"],
  comparison: ["comparison", "compare", "peer pressure", "identity", "own path"],
  courage: ["fear", "failure", "confidence", "courage", "weakness", "stuck"],
  grief: ["grief", "loss", "death", "mourning", "heartbreak", "pain"],
  anger: ["anger", "angry", "jealous", "addiction", "craving", "bad habit"],
  faith: ["faith", "god", "injustice", "dharma", "trust", "uncertainty"],
};

function getCandidateText(candidate) {
  return (candidate?.content?.parts || [])
    .map((part) => part?.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function pickLocalShlokaId(problem) {
  const words = String(problem || "")
    .toLowerCase()
    .match(/[a-z0-9']+/g) || [];
  const problemText = words.join(" ");

  let best = { id: "2.47", score: 0 };

  for (const shloka of SHLOKA_INDEX) {
    const haystack = `${shloka.summary} ${(shloka.tags || []).join(" ")}`.toLowerCase();
    let score = 0;

    for (const word of words) {
      if (word.length > 2 && haystack.includes(word)) {
        score += 2;
      }
    }

    for (const [topic, aliases] of Object.entries(FALLBACK_KEYWORDS)) {
      const problemMatchesTopic = aliases.some((alias) => problemText.includes(alias));
      const shlokaMatchesTopic =
        haystack.includes(topic) || aliases.some((alias) => haystack.includes(alias));

      if (problemMatchesTopic && shlokaMatchesTopic) {
        score += 5;
      }
    }

    if (score > best.score) {
      best = { id: shloka.id, score };
    }
  }

  return best.id;
}

function writeFallbackGuidance(problem, shloka) {
  const cleanProblem = String(problem || "this situation").trim();

  return [
    `You are facing ${cleanProblem}, and it makes sense that the mind wants a clear answer quickly. This shlok invites you to pause before the pressure of the outcome takes over.`,
    `Bhagavad Gita ${shloka.chapter}.${shloka.verse} points you back to the part that is yours to hold: your next sincere action, your steadiness, and your dharma in this moment. The result may still be uncertain, but your response can become cleaner and less scattered.`,
    "For today, choose one small action that is fully in your control. Do it with attention, then step back from replaying the result in your mind.",
  ].join("\n\n");
}

function cleanGuidanceText(text) {
  const cleaned = String(text || "")
    .replace(/```(?:json|text)?/gi, "")
    .replace(/```/g, "")
    .trim();

  if (!cleaned) return "";

  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed?.advice === "string") {
      return parsed.advice.trim();
    }
  } catch {
    // The guidance endpoint asks for plain text. JSON parsing is only a courtesy.
  }

  return cleaned
    .replace(/^here(?:'s| is)(?: the)?(?: guidance| response| advice)?[:\s-]*/i, "")
    .trim();
}

async function callGeminiText(
  prompt,
  {
    maxOutputTokens = 1200,
    temperature = 0.35,
  } = {}
) {
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
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message || `Gemini request failed with ${response.status}.`;
    console.error("[Gemini error]", response.status, data?.error);
    throw new Error(message);
  }

  const text = (data.candidates || [])
    .map(getCandidateText)
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    console.error("[Gemini empty response]", data);
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

export async function pickShlokaId(problem) {
  return pickLocalShlokaId(problem);
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
- Return plain text only. No JSON, no markdown, no preamble.
- Write 2-4 short paragraphs separated by blank lines.
- Follow three beats: honour the feeling, bring this verse to bear, offer one concrete action for today.
- Apply this specific shloka to this exact person's problem.
- Do not invent Sanskrit text or extra verse references.
- Avoid sounding clinical, generic, preachy, saccharine, or like a therapist.
- Prefer: guidance, shlok, path, dilemma, reflect, seek guidance, meaning.
- Avoid: journey, voyage, soul-searching, vibes, energy, AI-powered, leverage, unlock, click here, tap below, sorry to hear that.`;

  try {
    const text = await callGeminiText(prompt, {
      maxOutputTokens: 1400,
      temperature: 0.45,
    });
    const advice = cleanGuidanceText(text);

    if (advice.length > 80) {
      return advice;
    }

    console.warn("[Gemini advice warning] Short response, using local fallback.", text);
  } catch (error) {
    console.warn("[Gemini advice warning] Text response failed, using local fallback.", error);
  }

  return writeFallbackGuidance(problem, shloka);
}
