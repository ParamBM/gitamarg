"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowser, hasSupabaseEnv } from "@/lib/supabase";

function autosize(element) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${Math.max(110, element.scrollHeight)}px`;
}

function splitGuidance(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function toGuidance(data) {
  return {
    id: data.guidanceId,
    chapter: data.chapter,
    verse: data.verse,
    deva: data.sanskrit,
    roman: data.transliteration,
    english: data.meaning_english,
    translation: data.translation || data.meaning_english,
    guidance: splitGuidance(data.advice),
    plan: data.plan || "free",
  };
}

function BookOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function LanguagesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function MessageSquareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15.5-6.36L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.36L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function BookmarkIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  );
}

export default function HomeClient() {
  const [problem, setProblem] = useState("");
  const [verse, setVerse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [followup, setFollowup] = useState("");
  const [toast, setToast] = useState("");
  const [language, setLanguage] = useState("EN");
  const textareaRef = useRef(null);
  const followupRef = useRef(null);
  const loaderRef = useRef(null);
  const toastTimerRef = useRef(null);
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  useEffect(() => {
    autosize(textareaRef.current);
  }, [problem]);

  useEffect(() => {
    autosize(followupRef.current);
  }, [followup]);

  useEffect(() => {
    const cols = Array.from(document.querySelectorAll(".hiw .col"));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.dataset.step || 1) - 1;
            setTimeout(() => entry.target.classList.add("visible"), index * 140);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 }
    );

    cols.forEach((col) => io.observe(col));
    return () => io.disconnect();
  }, []);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 1800);
  }

  async function signIn() {
    if (!hasSupabaseEnv() || !supabase) {
      showToast("That didn't go through. Try again?");
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function getGuidance(text) {
    const response = await fetch("/api/gita", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problem: text }),
    });
    const data = await response.json();

    if (response.status === 401) {
      await signIn();
      return null;
    }

    if (response.status === 429) {
      throw new Error("Your next guidance unlocks after midnight.");
    }

    if (!response.ok) {
      throw new Error(data.message || "That didn't go through. Try again?");
    }

    return toGuidance(data);
  }

  async function startGuidance(text) {
    setVerse(null);
    setSaved(false);
    setLoading(true);

    setTimeout(() => {
      loaderRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);

    const startedAt = performance.now();
    const minimumDelay = 1600 + Math.random() * 800;

    try {
      const data = await getGuidance(text);
      const remainingDelay = Math.max(0, minimumDelay - (performance.now() - startedAt));
      await new Promise((resolve) => setTimeout(resolve, remainingDelay));

      if (data) {
        setVerse(data);
      }
    } catch (error) {
      showToast(error.message || "That didn't go through. Try again?");
    } finally {
      setLoading(false);
    }
  }

  function submitProblem(event) {
    event.preventDefault();
    const clean = problem.trim();

    if (!clean) {
      textareaRef.current?.focus();
      return;
    }

    startGuidance(clean);
  }

  function onTextareaKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function askAnother() {
    setProblem("");
    setFollowup("");
    setVerse(null);
    setSaved(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => textareaRef.current?.focus(), 250);
  }

  async function saveShlok() {
    if (!verse?.id) return;

    const response = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guidanceId: verse.id, bookmarked: true }),
    });

    if (response.status === 401) {
      await signIn();
      return;
    }

    if (response.status === 402) {
      showToast("Upgrade required");
      return;
    }

    if (!response.ok) {
      showToast("That didn't go through. Try again?");
      return;
    }

    setSaved(true);
    showToast("Shlok saved");
  }

  async function shareVerse() {
    if (!verse) return;

    if (verse.id) {
      const marker = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guidanceId: verse.id }),
      });

      if (marker.status === 401) {
        await signIn();
        return;
      }

      if (marker.status === 402) {
        showToast("Upgrade required");
        return;
      }
    }

    const text = `Bhagavad Gita ${verse.chapter}.${verse.verse}\n\n${verse.roman}\n\n"${verse.english}"\n\n— via GitaMarg`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "GitaMarg", text });
        return;
      } catch {
        // Clipboard fallback below.
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard");
    } catch {
      showToast("Could not copy");
    }
  }

  function askFollowup() {
    const clean = followup.trim();

    if (!clean) return;

    setProblem(clean);
    setFollowup("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    startGuidance(clean);
  }

  return (
    <>
      <div className="om-watermark" aria-hidden="true">
        ॐ
      </div>

      <header className="nav">
        <a className="brand" href="#top" aria-label="GitaMarg home">
          <span className="om" aria-hidden="true">
            ॐ
          </span>
          <span>GitaMarg</span>
        </a>
        <a className="link" href="#how">
          How it works
        </a>
      </header>

      <main id="top">
        <section className="section hero" id="hero">
          <div className="hero-eyebrow">
            <span className="rule" aria-hidden="true" />
            <span>Bhagavad Gita · AI Guidance</span>
            <span className="rule" aria-hidden="true" />
          </div>
          <h1 className="hero-title">
            <span className="line-1">Describe your problem.</span>
            <span className="line-2">The Gita will guide you.</span>
          </h1>
          <p className="hero-sub">
            Type any real-life dilemma. Receive a relevant shlok, its meaning, and
            personalised guidance — rooted in 5,000 years of wisdom.
          </p>

          <form className="chat-card" autoComplete="off" onSubmit={submitProblem}>
            <textarea
              ref={textareaRef}
              className="problem"
              value={problem}
              onChange={(event) => setProblem(event.target.value)}
              onKeyDown={onTextareaKeyDown}
              placeholder="Tell me what is troubling you… e.g. I feel stuck in my career and don't know what to do."
              rows="3"
              aria-label="Describe your problem"
            />

            <div className="chat-row">
              <span className="hint" aria-hidden="true">
                ⌘↵ to send
              </span>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Listening…" : "Seek Guidance →"}
              </button>
            </div>
          </form>

          <div className="chips" role="group" aria-label="Example prompts">
            <button type="button" className="chip" onClick={() => setProblem("I feel lost in life")}>
              I feel lost in life
            </button>
            <button type="button" className="chip" onClick={() => setProblem("Conflict with a loved one")}>
              Conflict with a loved one
            </button>
            <button type="button" className="chip" onClick={() => setProblem("Fear of failure")}>
              Fear of failure
            </button>
          </div>

          <div className={loading ? "loader is-active" : "loader"} ref={loaderRef} aria-live="polite">
            <span className="om" aria-hidden="true">
              ॐ
            </span>
            <span className="label">The Gita is listening…</span>
          </div>

          <div className="thread" aria-live="polite">
            {verse ? (
              <>
                <div className="bubble bubble-shlok" style={{ animationDelay: "0ms" }}>
                  <div className="eyebrow">
                    <BookOpenIcon /> Chapter {verse.chapter}, Verse {verse.verse}
                  </div>
                  <div className="deva" lang="sa">
                    {verse.deva.split("\n").map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                  <p className="roman">{verse.roman}</p>
                  <p className="english">{verse.english}</p>
                </div>

                <div className="bubble bubble-translation assistant-tail" style={{ animationDelay: "200ms" }}>
                  <div className="eyebrow">
                    <LanguagesIcon /> Meaning
                  </div>
                  <p>{verse.translation}</p>
                </div>

                <div className="bubble bubble-guidance" style={{ animationDelay: "400ms" }}>
                  <div className="eyebrow">
                    <CompassIcon /> Your Path Forward
                  </div>
                  {verse.guidance.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>

                <div className="actions" style={{ animationDelay: "650ms" }}>
                  <button type="button" className="action-btn" onClick={askAnother}>
                    <RefreshIcon /> Ask another
                  </button>
                  <button type="button" className={saved ? "action-btn is-saved" : "action-btn"} onClick={saveShlok}>
                    <BookmarkIcon filled={saved} /> {saved ? "Saved" : "Save shlok"}
                  </button>
                  <button type="button" className="action-btn" onClick={shareVerse}>
                    <ShareIcon /> Share
                  </button>
                </div>

                <div className="followup" style={{ animationDelay: "800ms" }}>
                  <textarea
                    ref={followupRef}
                    value={followup}
                    onChange={(event) => setFollowup(event.target.value)}
                    placeholder="Want to explore this further? Ask a follow-up…"
                    aria-label="Follow-up question"
                  />
                  <div className="row">
                    <button type="button" className="btn-secondary" onClick={askFollowup}>
                      Ask again
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </section>

        <section className="hiw" id="how">
          <p className="hiw-eyebrow">How it works</p>
          <h2>Three steps from question to guidance</h2>
          <div className="grid">
            <div className="col" data-step="1">
              <div className="icon" aria-hidden="true">
                <MessageSquareIcon />
              </div>
              <h3>Describe your problem</h3>
              <p>Type your real situation in plain words — no special vocabulary needed.</p>
            </div>
            <div className="col" data-step="2">
              <div className="icon" aria-hidden="true">
                <BookOpenIcon />
              </div>
              <h3>Gita finds the shlok</h3>
              <p>Our source-of-truth engine matches the right verse, with chapter and number.</p>
            </div>
            <div className="col" data-step="3">
              <div className="icon" aria-hidden="true">
                <CompassIcon />
              </div>
              <h3>Receive your guidance</h3>
              <p>
                AI translates ancient wisdom into practical, personal guidance — for your exact
                moment.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          <div className="brand-mini">
            <span className="om" aria-hidden="true">
              ॐ
            </span>
            <span className="brand-text">
              Gita<span className="brand-accent">Marg</span>
            </span>
          </div>
          <p className="credit">Rooted in the Bhagavad Gita. Built with reverence.</p>
          <div className="lang" role="group" aria-label="Language">
            <button className={language === "EN" ? "active" : ""} type="button" onClick={() => setLanguage("EN")}>
              EN
            </button>
            <button className={language === "HI" ? "active" : ""} type="button" onClick={() => setLanguage("HI")}>
              HI
            </button>
          </div>
        </div>
      </footer>

      <div className={toast ? "toast is-visible" : "toast"} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
