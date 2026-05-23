import { redirect } from "next/navigation";
import {
  ensureUserProfile,
  getAuthenticatedUser,
} from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function istDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function istMidnightIso(dateKey) {
  return new Date(`${dateKey}T00:00:00+05:30`).toISOString();
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

function formatCurrency(paise) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format((paise || 0) / 100);
}

function formatDate(value) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function buildDailySeries(guidance, days = 7) {
  const now = new Date();
  const labels = Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - 1 - index));
    return istDateKey(date);
  });
  const totals = Object.fromEntries(labels.map((label) => [label, 0]));

  guidance.forEach((row) => {
    const key = istDateKey(new Date(row.created_at));
    if (key in totals) {
      totals[key] += 1;
    }
  });

  return labels.map((label) => ({
    label: label.slice(5),
    total: totals[label],
  }));
}

function topShlokas(guidance) {
  const grouped = guidance.reduce((acc, row) => {
    const key = row.shloka_id;
    if (!acc[key]) {
      acc[key] = {
        shloka_id: key,
        chapter: row.chapter,
        verse: row.verse,
        total: 0,
        saved: 0,
        shared: 0,
      };
    }

    acc[key].total += 1;
    acc[key].saved += row.is_bookmarked ? 1 : 0;
    acc[key].shared += row.is_shared ? 1 : 0;
    return acc;
  }, {});

  return Object.values(grouped)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
}

async function getCount(admin, table, query = (builder) => builder) {
  const { count, error } = await query(
    admin.from(table).select("id", { count: "exact", head: true })
  );

  if (error) throw error;
  return count || 0;
}

export default async function AdminDashboard() {
  const { user } = await getAuthenticatedUser();

  if (!user) {
    redirect("/");
  }

  const profile = await ensureUserProfile(user);

  if (profile.role !== "admin") {
    redirect("/");
  }

  const admin = getSupabaseAdmin();
  const todayIso = istMidnightIso(istDateKey());
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoIso = istMidnightIso(istDateKey(sevenDaysAgo));

  const [
    usersCount,
    guidanceCount,
    todayGuidanceCount,
    savedCount,
    sharedCount,
    activeSubscriptionsCount,
    usersResult,
    guidanceResult,
    subscriptionsResult,
    quotasResult,
  ] = await Promise.all([
    getCount(admin, "users"),
    getCount(admin, "guidance"),
    getCount(admin, "guidance", (q) => q.gte("created_at", todayIso)),
    getCount(admin, "guidance", (q) => q.eq("is_bookmarked", true)),
    getCount(admin, "guidance", (q) => q.eq("is_shared", true)),
    getCount(admin, "subscriptions", (q) => q.eq("status", "active")),
    admin
      .from("users")
      .select("id,email,name,avatar_url,plan,role,total_questions,total_saved,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("guidance")
      .select("id,user_id,problem_text,shloka_id,chapter,verse,is_bookmarked,is_shared,created_at")
      .gte("created_at", sevenDaysAgoIso)
      .order("created_at", { ascending: false })
      .limit(1000),
    admin
      .from("subscriptions")
      .select("id,user_id,plan,amount_paise,status,starts_at,ends_at,created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("daily_quotas")
      .select("user_id,date_ist,questions_used")
      .gte("date_ist", istDateKey(sevenDaysAgo))
      .order("date_ist", { ascending: false })
      .limit(1000),
  ]);

  for (const result of [usersResult, guidanceResult, subscriptionsResult, quotasResult]) {
    if (result.error) throw result.error;
  }

  const users = usersResult.data || [];
  const guidance = guidanceResult.data || [];
  const subscriptions = subscriptionsResult.data || [];
  const quotas = quotasResult.data || [];
  const planMix = countBy(users, "plan");
  const roleMix = countBy(users, "role");
  const activeRevenue = subscriptions
    .filter((subscription) => subscription.status === "active")
    .reduce((sum, subscription) => sum + (subscription.amount_paise || 0), 0);
  const questionsUsed = quotas.reduce((sum, quota) => sum + (quota.questions_used || 0), 0);
  const dailySeries = buildDailySeries(guidance);
  const maxDaily = Math.max(1, ...dailySeries.map((day) => day.total));
  const topVerses = topShlokas(guidance);
  const recentUsers = users.slice(0, 8);
  const recentGuidance = guidance.slice(0, 8);

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">
          <img src="/gitamarg.webp" alt="GitaMarg" />
        </a>
        <p className="admin-subtitle">Admin Analytics</p>
        <nav className="admin-nav" aria-label="Admin sections">
          <a href="#overview">Overview</a>
          <a href="#activity">Activity</a>
          <a href="#users">Users</a>
          <a href="#guidance">Guidance</a>
        </nav>
      </aside>

      <section className="admin-main">
        <header className="admin-hero" id="overview">
          <p className="admin-eyebrow">GitaMarg Control Room</p>
          <h1>Detailed analytics for the path people are seeking.</h1>
          <p>
            Live operating view across auth, quota, guidance, saves, shares, and subscriptions.
            Admin accounts bypass quota and can generate without restriction.
          </p>
        </header>

        <section className="admin-metrics" aria-label="Key metrics">
          <div className="admin-metric">
            <span>Total users</span>
            <strong>{formatNumber(usersCount)}</strong>
            <small>{formatNumber(roleMix.admin)} admins</small>
          </div>
          <div className="admin-metric">
            <span>Total guidance</span>
            <strong>{formatNumber(guidanceCount)}</strong>
            <small>{formatNumber(todayGuidanceCount)} today IST</small>
          </div>
          <div className="admin-metric">
            <span>Saves</span>
            <strong>{formatNumber(savedCount)}</strong>
            <small>{formatNumber(sharedCount)} shares</small>
          </div>
          <div className="admin-metric">
            <span>Active plans</span>
            <strong>{formatNumber(activeSubscriptionsCount)}</strong>
            <small>{formatCurrency(activeRevenue)} active value</small>
          </div>
        </section>

        <section className="admin-grid" id="activity">
          <div className="admin-panel admin-panel-wide">
            <div className="admin-panel-head">
              <div>
                <p className="admin-eyebrow">Last 7 Days</p>
                <h2>Guidance generated</h2>
              </div>
              <span>{formatNumber(guidance.length)} records</span>
            </div>
            <div className="admin-bars">
              {dailySeries.map((day) => (
                <div className="admin-bar-day" key={day.label}>
                  <div className="admin-bar-track">
                    <span style={{ height: `${Math.max(8, (day.total / maxDaily) * 100)}%` }} />
                  </div>
                  <strong>{day.total}</strong>
                  <small>{day.label}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <p className="admin-eyebrow">Plans</p>
                <h2>User mix</h2>
              </div>
            </div>
            <div className="admin-list compact">
              <div><span>Free</span><strong>{formatNumber(planMix.free)}</strong></div>
              <div><span>Monthly</span><strong>{formatNumber(planMix.monthly)}</strong></div>
              <div><span>Annual</span><strong>{formatNumber(planMix.annual)}</strong></div>
              <div><span>Quota uses</span><strong>{formatNumber(questionsUsed)}</strong></div>
            </div>
          </div>
        </section>

        <section className="admin-grid">
          <div className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <p className="admin-eyebrow">Shlokas</p>
                <h2>Most matched</h2>
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Verse</th><th>Total</th><th>Saved</th><th>Shared</th></tr>
                </thead>
                <tbody>
                  {topVerses.map((verse) => (
                    <tr key={verse.shloka_id}>
                      <td>{verse.chapter}.{verse.verse}</td>
                      <td>{verse.total}</td>
                      <td>{verse.saved}</td>
                      <td>{verse.shared}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-panel" id="users">
            <div className="admin-panel-head">
              <div>
                <p className="admin-eyebrow">Latest</p>
                <h2>Recent users</h2>
              </div>
            </div>
            <div className="admin-list">
              {recentUsers.map((item) => (
                <div key={item.id}>
                  <span>
                    <b>{item.name || "Seeker"}</b>
                    <small>{item.email}</small>
                  </span>
                  <strong>{item.role}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="admin-panel" id="guidance">
          <div className="admin-panel-head">
            <div>
              <p className="admin-eyebrow">Recent Guidance</p>
              <h2>Latest questions saved to the system</h2>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Problem</th><th>Verse</th><th>Signals</th><th>Created</th></tr>
              </thead>
              <tbody>
                {recentGuidance.map((item) => (
                  <tr key={item.id}>
                    <td className="admin-problem">{item.problem_text}</td>
                    <td>{item.chapter}.{item.verse}</td>
                    <td>
                      {item.is_bookmarked ? "Saved" : "Not saved"}
                      {item.is_shared ? " / Shared" : ""}
                    </td>
                    <td>{formatDate(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
