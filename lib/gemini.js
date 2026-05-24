import { SHLOKA_INDEX } from "@/lib/shlokas";

const DEFAULT_MODEL = "gemini-3.5-flash";

const FALLBACK_KEYWORDS = {
  anxiety: [
    "anxious",
    "anxiety",
    "overthinking",
    "stress",
    "restless",
    "panic",
    "worried",
    "worry",
  ],
  burnout: [
    "burnout",
    "overwhelmed",
    "exhausted",
    "tired",
    "hopeless",
    "giving up",
    "pressure",
  ],
  career: [
    "career",
    "job",
    "work",
    "business",
    "startup",
    "interview",
    "exam",
    "study",
    "marks",
    "promotion",
  ],
  comparison: [
    "comparison",
    "compare",
    "peer pressure",
    "identity",
    "own path",
    "confused",
    "confusion",
  ],
  courage: [
    "fear",
    "failure",
    "confidence",
    "courage",
    "weakness",
    "stuck",
    "paralyzed",
    "paralysis",
  ],
  grief: [
    "grief",
    "loss",
    "death",
    "mourning",
    "heartbreak",
    "pain",
    "breakup",
    "separation",
  ],
  anger: [
    "anger",
    "angry",
    "jealous",
    "jealousy",
    "addiction",
    "craving",
    "bad habit",
    "temptation",
  ],
  faith: [
    "faith",
    "god",
    "injustice",
    "dharma",
    "trust",
    "uncertainty",
    "money",
    "financial",
  ],
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "you",
  "your",
  "but",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "not",
  "dont",
  "can't",
  "can",
  "from",
  "what",
  "when",
  "where",
  "why",
  "how",
  "feel",
  "feeling",
  "really",
  "very",
  "just",
  "like",
  "into",
  "about",
  "because",
]);

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
    .replace(/[’]/g, "'")
    .match(/[a-z0-9']+/g) || [];
  const meaningfulWords = words.filter(
    (word) => word.length > 2 && !STOP_WORDS.has(word)
  );
  const problemText = words.join(" ");

  let best = { id: "2.47", score: -1 };

  for (const shloka of SHLOKA_INDEX) {
    const haystack = `${shloka.summary} ${(shloka.tags || []).join(" ")}`.toLowerCase();
    let score = 0;

    for (const word of meaningfulWords) {
      if (haystack.includes(word)) {
        score += 2;
      }
    }

    for (const tag of shloka.tags || []) {
      const normalizedTag = tag.toLowerCase();
      if (problemText.includes(normalizedTag)) {
        score += Math.max(8, normalizedTag.split(/\s+/).length * 5);
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
    "What this shlok is showing you",
    `You are facing ${cleanProblem}, and it makes sense that the mind wants certainty before it moves. Bhagavad Gita ${shloka.chapter}.${shloka.verse} brings the focus back to the part that is yours to hold: the next sincere action, the quality of your intention, and the steadiness with which you meet the moment.`,
    "",
    "How it applies to your situation",
    `This shlok does not ask you to ignore the result or pretend the problem is small. It asks you to stop letting the result become the master of your mind. When you act from dharma instead of fear, your response becomes cleaner, less scattered, and more honest.`,
    "",
    "Call to action",
    "- Write down the one part of this situation that is truly in your control today.",
    "- Take one concrete step on that part before you revisit the outcome.",
    "- After acting, pause for two minutes and repeat the meaning of this shlok in your own words.",
    "- Avoid one action that is only driven by panic, comparison, or the need for quick reassurance.",
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
- Return plain text only. No JSON, no code fences, no preamble.
- Use exactly these three section headings, each on its own line:
  What this shlok is showing you
  How it applies to your situation
  Call to action
- Under the first two headings, write detailed but readable guidance in 1-2 paragraphs each.
- Under "Call to action", write 4-6 bullet points. Each bullet must begin with "- " and must be a concrete next step the user can take.
- The whole answer should be 350-650 words unless the user's problem is very short.
- Apply this specific shloka to this exact person's problem.
- Explicitly connect the advice to the verse's meaning, not only to a generic spiritual idea.
- Do not invent Sanskrit text or extra verse references.
- Do not say the answer is based on a random prompt or general AI advice.
- Avoid sounding clinical, generic, preachy, saccharine, or like a therapist.
- Prefer: guidance, shlok, path, dilemma, reflect, seek guidance, meaning.
- Avoid: journey, voyage, soul-searching, vibes, energy, AI-powered, leverage, unlock, click here, tap below, sorry to hear that.`;

  try {
    const text = await callGeminiText(prompt, {
      maxOutputTokens: 2200,
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
