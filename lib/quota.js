export function getTodayIstDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );

  return `${value.year}-${value.month}-${value.day}`;
}

export function isDayOne(signupDateIst) {
  return Boolean(signupDateIst && signupDateIst === getTodayIstDate());
}

export function msUntilNextIstMidnight(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );

  const year = Number(value.year);
  const month = Number(value.month);
  const day = Number(value.day);
  const nextIstMidnightUtc = Date.UTC(year, month - 1, day + 1, -5, -30, 0);

  return Math.max(0, nextIstMidnightUtc - now.getTime());
}

export function formatCountdown(ms) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function getQuotaMessage(quota, plan = "free") {
  if (!quota || plan === "monthly" || plan === "annual") {
    return null;
  }

  const limit = Number(quota.limit || 1);
  const used = Number(quota.used || quota.questions_used || 0);
  const remaining = Math.max(0, limit - used);
  const countdown = formatCountdown(msUntilNextIstMidnight());

  if (quota.is_day_one && remaining > 0) {
    return {
      tone: "welcome",
      primary: `Welcome -- ${remaining} of 3 welcome questions remaining today`,
      secondary: "From tomorrow, 1 question per day. Upgrade for unlimited.",
    };
  }

  if (quota.is_day_one && remaining === 0) {
    return {
      tone: "locked",
      primary: `Your next guidance unlocks in ${countdown}`,
      secondary: "Or seek unlimited wisdom for Rs.49/month · Upgrade",
    };
  }

  if (!quota.is_day_one && remaining === 0) {
    return {
      tone: "locked",
      primary: `Your next guidance unlocks in ${countdown}`,
      secondary: "Or seek unlimited wisdom for Rs.49/month · Upgrade",
    };
  }

  return null;
}

export function buildQuotaFromProfile(profile, dailyQuota) {
  if (!profile || profile.plan === "monthly" || profile.plan === "annual") {
    return null;
  }

  const dayOne = isDayOne(profile.signup_date_ist);
  const limit = dayOne ? 3 : 1;
  const used = dailyQuota?.questions_used || 0;

  return {
    allowed: used < limit,
    used,
    limit,
    is_day_one: dayOne,
  };
}
