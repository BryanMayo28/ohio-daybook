#!/usr/bin/env node
// Weekly "best of the weekend" email for one city, sent through Resend (resend.com).
//   RESEND_API_KEY=re_... DIGEST_TO=you@example.com node scripts/digest.mjs
// Optional: DIGEST_CITY (default columbus), SITE_URL, DIGEST_FROM.
// Without RESEND_API_KEY and DIGEST_TO it only prints what it would send.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cityId = process.env.DIGEST_CITY || "columbus";
const site = (process.env.SITE_URL || "https://bryanmayo28.github.io/ohio-daybook/").replace(/\/?$/, "/");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const CAT_LABEL = { music: "Music", sports: "Sports", arts: "Arts & theater", comedy: "Comedy", family: "Family", festival: "Festival", market: "Market", food: "Food & drink", outdoors: "Outdoors", community: "Community" };

function weekendDates(now = new Date()) {
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dow = et.getDay();
  const toFri = (5 - dow + 7) % 7;
  return [0, 1, 2].map((i) => { const d = new Date(et); d.setDate(d.getDate() + toFri + i); return d.toISOString().slice(0, 10); });
}
const onDay = (e, d) => e.s <= d && (e.e || e.s) >= d;
const span = (e) => (e.e ? (new Date(e.e) - new Date(e.s)) / 864e5 : 0);
const dayName = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

function score(e) {
  return (e.img ? 3 : 0) + (e.p ? 2 : 0) + (e.d && e.d.length > 80 ? 2 : 0) + (e.u ? 1 : 0) + (e.z === "core" ? 1 : 0) + (e.pm === 0 ? 1 : 0);
}

function pickFor(events, day, taken) {
  const pool = events.filter((e) => onDay(e, day) && span(e) <= 6 && !taken.has(e.n)).sort((a, b) => score(b) - score(a));
  const picks = [], cats = new Map();
  for (const e of pool) {
    if ((cats.get(e.c) || 0) >= 2) continue;
    picks.push(e); taken.add(e.n); cats.set(e.c, (cats.get(e.c) || 0) + 1);
    if (picks.length >= 5) break;
  }
  return picks.sort((a, b) => a.m - b.m);
}

function itemHTML(e) {
  const meta = [e.t || "All day", e.v, e.a].filter(Boolean).map(esc).join(" · ");
  const price = e.p ? `<span style="font-weight:700;color:${e.pm === 0 ? "#17834B" : "#16202E"}">${esc(e.p)}</span> · ` : "";
  const img = e.img ? `<img src="${esc(e.img)}" width="560" alt="" style="width:100%;max-width:560px;height:auto;border-radius:12px;display:block;margin:0 0 10px">` : "";
  const desc = e.d ? `<p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:#3A4556">${esc(e.d.length > 260 ? e.d.slice(0, 257).replace(/\s+\S*$/, "") + "…" : e.d)}</p>` : "";
  const link = e.u ? `<a href="${esc(e.u)}" style="color:#1F5FD1;font-weight:700;text-decoration:none;font-size:14px">${/Ticketmaster|SeatGeek/.test(e.src) ? "Tickets" : "Details"} →</a>` : "";
  return `<tr><td style="padding:0 0 22px">${img}<div style="font-size:12px;font-weight:700;color:#1F5FD1;text-transform:uppercase;letter-spacing:.04em">${esc(CAT_LABEL[e.c] || "Event")}</div><div style="font-size:18px;font-weight:800;color:#16202E;margin:2px 0">${esc(e.n)}</div><div style="font-size:13px;color:#5C6779">${price}${meta}</div>${desc}<div style="margin-top:6px">${link}</div></td></tr>`;
}

async function main() {
  const file = JSON.parse(await readFile(path.join(root, "public", "data", `${cityId}.json`), "utf8"));
  const days = weekendDates();
  const taken = new Set();
  const sections = days.map((d) => ({ d, picks: pickFor(file.events, d, taken) })).filter((s) => s.picks.length);
  const free = file.events.filter((e) => days.some((d) => onDay(e, d)) && e.pm === 0 && !taken.has(e.n)).slice(0, 6);
  const cityName = cityId[0].toUpperCase() + cityId.slice(1);
  const subject = `This weekend in ${cityName}: ${sections.flatMap((s) => s.picks).slice(0, 2).map((e) => e.n).join(", ")} and more`;

  const html = `<!doctype html><html><body style="margin:0;background:#F3F5F8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:16px"><tr><td style="padding:24px 20px">
<div style="font-size:22px;font-weight:800;color:#16202E">Ohio Daybook</div>
<div style="font-size:15px;color:#5C6779;margin:4px 0 20px">Weekend picks for ${esc(cityName)}, ${esc(dayName(days[0]))} – ${esc(dayName(days[2]))}</div>
${sections.map((s) => `<div style="font-size:13px;font-weight:800;color:#5C6779;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #E3E7EE;padding-bottom:6px;margin:6px 0 14px">${esc(dayName(s.d))}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${s.picks.map(itemHTML).join("")}</table>`).join("")}
${free.length ? `<div style="font-size:13px;font-weight:800;color:#5C6779;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #E3E7EE;padding-bottom:6px;margin:6px 0 10px">Also free this weekend</div><ul style="margin:0 0 20px;padding-left:18px;color:#16202E;font-size:14px;line-height:1.7">${free.map((e) => `<li>${esc(e.n)} <span style="color:#5C6779">· ${esc(e.v)}</span></li>`).join("")}</ul>` : ""}
<a href="${esc(site)}#${cityId}" style="display:inline-block;background:#1F5FD1;color:#FFFFFF;font-weight:700;text-decoration:none;border-radius:10px;padding:11px 16px">See everything this weekend</a>
</td></tr></table></td></tr></table></body></html>`;

  const key = process.env.RESEND_API_KEY;
  const to = process.env.DIGEST_TO;
  if (!key || !to) {
    await writeFile(path.join(root, "digest-preview.html"), html);
    console.log(`RESEND_API_KEY or DIGEST_TO not set: wrote digest-preview.html instead.\nSubject: ${subject}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.DIGEST_FROM || "Ohio Daybook <onboarding@resend.dev>", to: to.split(",").map((s) => s.trim()), subject, html }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend said ${res.status}: ${body}`);
  console.log(`Sent "${subject}" to ${to}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
