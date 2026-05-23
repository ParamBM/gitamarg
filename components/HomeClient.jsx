"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowser, hasSupabaseEnv } from "@/lib/supabase";

const appOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

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

function GitaMargMark() {
  return (
    <svg className="gita-mark" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="currentColor"
        d="M385 40c-61 0-110 42-122 99h-27c-63 0-114 51-114 114v13H70c-17 0-31 14-31 31s14 31 31 31h52v48H72c-17 0-31 14-31 31s14 31 31 31h159c69 0 125-56 125-125v-31h-62v31c0 35-28 63-63 63h-47v-48h22c63 0 114-51 114-114v-13h65c45 0 82-36 82-81s-37-80-82-80Zm-179 226h-22v-13c0-29 23-52 52-52h22v13c0 29-23 52-52 52Zm179-126h-59c10-22 32-38 59-38 11 0 20 8 20 18s-9 20-20 20Z"
      />
      <path
        fill="currentColor"
        d="M302 151h156c13 0 24 11 24 24s-11 24-24 24H302v-48Zm45 96h112c13 0 24 11 24 24s-11 24-24 24H347v-48Zm-11 96h122c13 0 24 11 24 24s-11 24-24 24H303c18-12 30-29 33-48Z"
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="13"
        d="M149 160c23-34 62-55 106-55m-60 144c27 0 48-22 48-48m-55 245c49 0 93-25 118-64m68-233c-17 4-32 12-44 25m39 121c18-15 43-24 71-24"
        opacity="0.26"
      />
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [emailSigningIn, setEmailSigningIn] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const textareaRef = useRef(null);
  const followupRef = useRef(null);
  const loaderRef = useRef(null);
  const toastTimerRef = useRef(null);
  const userMenuRef = useRef(null);
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

  // Track auth state
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data?.session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) {
      setProfile(null);
      return;
    }

    let alive = true;

    supabase
      .from("users")
      .select("role, plan")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (alive) {
          setProfile(data || null);
        }
      });

    return () => {
      alive = false;
    };
  }, [supabase, user]);

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenuOpen]);

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

    setSigningIn(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${appOrigin || window.location.origin}/auth/callback`,
      },
    });
    setSigningIn(false);
  }

  async function signInWithEmail(event) {
    event.preventDefault();

    if (!hasSupabaseEnv() || !supabase) {
      showToast("That didn't go through. Try again?");
      return;
    }

    const email = authEmail.trim();

    if (!email) {
      showToast("Enter your email");
      return;
    }

    setEmailSigningIn(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${appOrigin || window.location.origin}/auth/callback`,
      },
    });
    setEmailSigningIn(false);

    if (error) {
      showToast(error.message || "That didn't go through. Try again?");
      return;
    }

    showToast("Check your email");
  }

  async function signOut() {
    if (!supabase) return;
    setUserMenuOpen(false);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setVerse(null);
    setSaved(false);
    setProblem("");
    showToast("Signed out");
  }

  async function getGuidance(text) {
    const response = await fetch("/api/gita", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problem: text }),
    });
    const data = await response.json();

    if (response.status === 401) {
      setShowAuthModal(true);
      return null;
    }

    if (response.status === 429) {
      throw new Error("Your next guidance unlocks after midnight.");
    }

    if (!response.ok) {
      if (response.status === 500) {
        console.error("API ERROR DETAILS:", data);
      }
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

  const isAdmin = profile?.role === "admin";

  return (
    <>
      <div className="om-watermark" aria-hidden="true">
        <img src="/icon.webp" alt="" width="380" height="380" />
      </div>

      <header className="nav">
        <a className="brand" href="#top" aria-label="GitaMarg home">
          <img src="/gitamarg.webp" alt="GitaMarg" className="brand-logo" />
        </a>
        <div className="nav-right">
          <a className="link" href="#how">How it works</a>
          {user ? (
            <div className="user-menu-wrap" ref={userMenuRef}>
              <button
                className="user-avatar-btn"
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={userMenuOpen}
              >
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={user.user_metadata?.full_name || "User"}
                    className="user-avatar-img"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="user-avatar-fallback">
                    {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
                  </span>
                )}
              </button>
              {userMenuOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-info">
                    {user.user_metadata?.avatar_url && (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt=""
                        className="user-dropdown-avatar"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div>
                      <p className="user-dropdown-name">{user.user_metadata?.full_name || "Seeker"}</p>
                      <p className="user-dropdown-email">{user.email}</p>
                    </div>
                  </div>
                  <div className="user-dropdown-divider" />
                  {isAdmin && (
                    <a className="user-dropdown-link" href="/admin">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                      </svg>
                      Dashboard
                    </a>
                  )}
                  <button className="user-dropdown-signout" onClick={signOut}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" x2="9" y1="12" y2="12" />
                    </svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              className="login-nav-btn"
              type="button"
              onClick={() => setShowAuthModal(true)}
            >
              Login
            </button>
          )}
        </div>
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
            <img className="om-icon" src="/icon.webp" alt="" aria-hidden="true" width="120" height="120" />
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
            <img src="/gitamarg.webp" alt="GitaMarg" className="brand-logo-footer" />
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

      {showAuthModal && (
        <div className="auth-backdrop" role="dialog" aria-modal="true" aria-label="Sign in" onClick={(e) => { if (e.target === e.currentTarget) setShowAuthModal(false); }}>
          <div className="auth-modal">
            <button className="auth-modal-close" aria-label="Close" onClick={() => setShowAuthModal(false)}>✕</button>

            <img src="/gitamarg.webp" alt="GitaMarg" className="auth-modal-logo" />

            <h2 className="auth-modal-title">Seek the Gita&apos;s guidance</h2>
            <p className="auth-modal-sub">
              Sign in to receive a personalised shlok and guidance rooted in 5,000 years of wisdom.
            </p>

            <button
              className="auth-google-btn"
              onClick={signIn}
              disabled={signingIn}
            >
              <svg className="auth-google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {signingIn ? "Redirecting…" : "Continue with Google"}
            </button>

            <div className="auth-divider"><span>or</span></div>

            <form className="auth-email-form" onSubmit={signInWithEmail}>
              <label className="auth-email-label" htmlFor="auth-email">Email address</label>
              <input
                id="auth-email"
                className="auth-email-input"
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <button className="auth-email-btn" type="submit" disabled={emailSigningIn}>
                {emailSigningIn ? "Sending link..." : "Continue with email"}
              </button>
            </form>

            <p className="auth-modal-note">Free · No credit card required</p>
          </div>
        </div>
      )}

      <div className={toast ? "toast is-visible" : "toast"} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
