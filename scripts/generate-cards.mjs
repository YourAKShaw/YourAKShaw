#!/usr/bin/env node
// Generates the animated activity cards for the profile README.
// Usage: GITHUB_TOKEN=... node scripts/generate-cards.mjs [login] [outDir]
// No dependencies: Node 18+ fetch and the GitHub GraphQL API only.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const LOGIN = process.argv[2] || process.env.CARD_LOGIN || "YourAKShaw";
const OUT = process.argv[3] || "dist";
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error("GITHUB_TOKEN is required");
  process.exit(1);
}

const C = {
  bg: "#0D1117", panel: "#0F1A1C", border: "#134E4A", teal: "#2DD4BF",
  tealDeep: "#14B8A6", amber: "#F59E0B", text: "#C9D1D9", muted: "#8B949E",
  white: "#FFFFFF", grid: "#16302E",
};

async function gql(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "profile-cards" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(JSON.stringify(body.errors || body));
  return body.data;
}

async function fetchData() {
  const base = await gql(`query($login:String!){user(login:$login){
    name createdAt followers{totalCount}
    pullRequests{totalCount} issues{totalCount}
    repositoriesContributedTo(contributionTypes:[COMMIT,PULL_REQUEST,ISSUE,REPOSITORY]){totalCount}
    contributionsCollection{totalCommitContributions totalPullRequestReviewContributions}
  }}`, { login: LOGIN });
  const user = base.user;

  const repos = [];
  let after = null;
  do {
    const d = await gql(`query($login:String!,$after:String){user(login:$login){
      repositories(ownerAffiliations:OWNER,isFork:false,privacy:PUBLIC,first:100,after:$after){
        pageInfo{hasNextPage endCursor}
        nodes{stargazerCount forkCount languages(first:12,orderBy:{field:SIZE,direction:DESC}){edges{size node{name color}}}}
      }}}`, { login: LOGIN, after });
    const r = d.user.repositories;
    repos.push(...r.nodes);
    after = r.pageInfo.hasNextPage ? r.pageInfo.endCursor : null;
  } while (after);

  // One contribution calendar per year since the account was created.
  const days = [];
  const startYear = new Date(user.createdAt).getUTCFullYear();
  const now = new Date();
  for (let y = startYear; y <= now.getUTCFullYear(); y++) {
    const from = new Date(Date.UTC(y, 0, 1)).toISOString();
    const to = (y === now.getUTCFullYear() ? now : new Date(Date.UTC(y, 11, 31, 23, 59, 59))).toISOString();
    const d = await gql(`query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){
      contributionsCollection(from:$from,to:$to){contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`,
      { login: LOGIN, from, to });
    for (const w of d.user.contributionsCollection.contributionCalendar.weeks) days.push(...w.contributionDays);
  }
  const seen = new Set();
  const calendar = days.filter((d) => !seen.has(d.date) && seen.add(d.date)).sort((a, b) => a.date.localeCompare(b.date));

  return { user, repos, calendar };
}

// ---------- helpers ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => (n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : n.toLocaleString("en-US"));
const fmtDate = (iso, withYear = true) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });

const FONT = `text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif}.m{font-family:ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace}`;
const BASE_ANIM = `
.rise{animation:rise .9s cubic-bezier(.2,.7,.2,1) both}@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.o{transform-box:fill-box;transform-origin:center}
.pulse{animation:pulse 3s ease-in-out infinite}@keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}
.scan{animation:scan 6s linear infinite}@keyframes scan{from{transform:translateX(-120px)}to{transform:translateX(600px)}}
.blink{animation:blink 1.2s steps(2,jump-none) infinite}@keyframes blink{from{opacity:1}to{opacity:0}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

function frame({ title, desc, label, body, extraStyle = "", w = 480, h = 190 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="t d">
<title id="t">${esc(title)}</title><desc id="d">${esc(desc)}</desc>
<style>${FONT}${BASE_ANIM}${extraStyle}</style>
<defs>
<linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.teal}" stop-opacity=".9"/><stop offset=".5" stop-color="${C.border}"/><stop offset="1" stop-color="${C.amber}" stop-opacity=".7"/></linearGradient>
<linearGradient id="beam" x1="0" x2="1"><stop offset="0" stop-color="${C.teal}" stop-opacity="0"/><stop offset=".5" stop-color="${C.teal}" stop-opacity=".16"/><stop offset="1" stop-color="${C.teal}" stop-opacity="0"/></linearGradient>
<radialGradient id="glow" cx=".1" cy="0" r=".9"><stop offset="0" stop-color="${C.tealDeep}" stop-opacity=".18"/><stop offset="1" stop-color="${C.bg}" stop-opacity="0"/></radialGradient>
<pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${C.grid}"/></pattern>
<clipPath id="card"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="14"/></clipPath>
</defs>
<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="14" fill="${C.bg}"/>
<g clip-path="url(#card)">
<rect width="${w}" height="${h}" fill="url(#dots)"/>
<rect width="${w}" height="${h}" fill="url(#glow)"/>
<rect class="scan" x="0" y="0" width="120" height="${h}" fill="url(#beam)"/>
</g>
<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="14" fill="none" stroke="url(#edge)" stroke-width="1.5"/>
<g class="rise"><circle class="pulse" cx="24" cy="24" r="4" fill="${C.teal}"/>
<text x="36" y="28.5" font-size="13" font-weight="700" fill="${C.teal}" letter-spacing=".4">${esc(label)}</text></g>
${body}
</svg>
`;
}

// ---------- card 1: telemetry ----------
function statsCard({ user, repos, calendar }) {
  const stars = repos.reduce((s, r) => s + r.stargazerCount, 0);
  const total = calendar.reduce((s, d) => s + d.contributionCount, 0);
  const year = new Date().getUTCFullYear();
  const yearTotal = calendar.filter((d) => d.date.startsWith(String(year))).reduce((s, d) => s + d.contributionCount, 0);
  const rows = [
    ["Commits " + year, user.contributionsCollection.totalCommitContributions, C.teal],
    ["Pull requests", user.pullRequests.totalCount, C.amber],
    ["Issues opened", user.issues.totalCount, C.teal],
    ["Contributed to", user.repositoriesContributedTo.totalCount, C.amber],
    ["Stars earned", stars, C.teal],
  ];
  const max = Math.max(...rows.map((r) => r[1]), 1);
  const rowsSvg = rows.map(([k, v, col], i) => {
    const y = 58 + i * 25;
    const bw = Math.max(4, Math.round((Math.log10(v + 1) / Math.log10(max + 1)) * 106));
    const delay = (0.25 + i * 0.12).toFixed(2);
    return `<g class="rise" style="animation-delay:${delay}s">
<text x="24" y="${y + 4}" font-size="12" fill="${C.text}">${esc(k)}</text>
<rect x="146" y="${y - 3}" width="106" height="6" rx="3" fill="${C.grid}"/>
<rect class="grow" style="animation-delay:${delay}s" x="146" y="${y - 3}" width="${bw}" height="6" rx="3" fill="${col}"/>
<text class="m" x="300" y="${y + 4}" font-size="13" font-weight="700" fill="${C.white}" text-anchor="end">${fmt(v)}</text></g>`;
  }).join("\n");

  // Ring: progress toward the next thousand lifetime contributions.
  const next = Math.ceil((total + 1) / 1000) * 1000;
  const frac = (total % 1000) / 1000 || 0.001;
  const R = 46, CIRC = 2 * Math.PI * R;
  const cx = 392, cy = 104;
  const ticks = Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * 2 * Math.PI - Math.PI / 2;
    const r1 = 56, r2 = i % 5 ? 59 : 62;
    return `<line x1="${(cx + r1 * Math.cos(a)).toFixed(1)}" y1="${(cy + r1 * Math.sin(a)).toFixed(1)}" x2="${(cx + r2 * Math.cos(a)).toFixed(1)}" y2="${(cy + r2 * Math.sin(a)).toFixed(1)}"/>`;
  }).join("");

  const body = `
<text class="m rise" x="456" y="28.5" font-size="10" fill="${C.muted}" text-anchor="end">@${esc(LOGIN)}</text>
${rowsSvg}
<g class="o spin" style="transform-origin:${cx}px ${cy}px" stroke="${C.border}" stroke-width="1.2">${ticks}</g>
<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${C.grid}" stroke-width="8"/>
<circle class="ring" cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="url(#ringGrad)" stroke-width="8" stroke-linecap="round"
  stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${CIRC.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"
  style="--to:${(CIRC * (1 - frac)).toFixed(1)}"/>
<g class="rise" style="animation-delay:.8s">
<text class="m" x="${cx}" y="${cy + 2}" font-size="21" font-weight="800" fill="${C.white}" text-anchor="middle">${fmt(total)}</text>
<text x="${cx}" y="${cy + 18}" font-size="9.5" fill="${C.muted}" text-anchor="middle" letter-spacing=".6">CONTRIBUTIONS</text></g>
<text class="m rise" style="animation-delay:1s" x="${cx}" y="180" font-size="9.5" fill="${C.amber}" text-anchor="middle">${fmt(yearTotal)} in ${year} · next ${fmt(next)}</text>`;

  return frame({
    title: `${LOGIN}'s GitHub telemetry`,
    desc: rows.map(([k, v]) => `${k}: ${v}`).join(", ") + `. ${total} lifetime contributions.`,
    label: "Engineering telemetry",
    extraStyle: `
.grow{transform-box:fill-box;transform-origin:left;animation:grow 1.2s cubic-bezier(.2,.7,.2,1) both}@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.ring{animation:ring 1.8s cubic-bezier(.3,.7,.2,1) .3s forwards}@keyframes ring{to{stroke-dashoffset:var(--to)}}
.spin{animation:spin 30s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`,
    body: body + `<defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.teal}"/><stop offset="1" stop-color="${C.amber}"/></linearGradient></defs>`,
  });
}

// ---------- card 2: streak + heatmap ----------
function streaks(calendar) {
  const today = new Date().toISOString().slice(0, 10);
  const days = calendar.filter((d) => d.date <= today);
  let longest = { n: 0, start: null, end: null };
  let run = { n: 0, start: null };
  for (const d of days) {
    if (d.contributionCount > 0) {
      if (!run.n) run.start = d.date;
      run.n++;
      if (run.n > longest.n) longest = { n: run.n, start: run.start, end: d.date };
    } else run = { n: 0, start: null };
  }
  // Current streak may survive a zero "today" (the day is not over yet).
  let i = days.length - 1;
  if (i >= 0 && days[i].contributionCount === 0) i--;
  let cur = { n: 0, start: null, end: i >= 0 ? days[i].date : null };
  while (i >= 0 && days[i].contributionCount > 0) { cur.n++; cur.start = days[i].date; i--; }
  return { cur, longest, total: days.reduce((s, d) => s + d.contributionCount, 0), first: days.find((d) => d.contributionCount > 0)?.date };
}

function streakCard({ calendar }) {
  const s = streaks(calendar);
  const WEEKS = 22;
  const recent = calendar.slice(-WEEKS * 7);
  // Align to weekday columns.
  const pad = new Date(`${recent[0].date}T00:00:00Z`).getUTCDay();
  const cells = [...Array(pad).fill(null), ...recent];
  const maxC = Math.max(...recent.map((d) => d.contributionCount), 1);
  const shade = (n) => {
    if (!n) return [C.grid, 1];
    const q = n / maxC;
    if (q > 0.66) return [C.amber, 1];
    if (q > 0.33) return [C.teal, 1];
    if (q > 0.12) return [C.teal, 0.6];
    return [C.tealDeep, 0.38];
  };
  const SZ = 9, GAP = 2.4, X0 = 186, Y0 = 52;
  const grid = cells.map((d, k) => {
    if (!d) return "";
    const col = Math.floor(k / 7), row = k % 7;
    const [fill, op] = shade(d.contributionCount);
    const delay = ((col + row) * 0.03).toFixed(2);
    const hot = d.contributionCount && d.contributionCount / maxC > 0.66 ? " hot" : "";
    return `<rect class="cell${hot}" style="animation-delay:${delay}s" x="${(X0 + col * (SZ + GAP)).toFixed(1)}" y="${(Y0 + row * (SZ + GAP)).toFixed(1)}" width="${SZ}" height="${SZ}" rx="2" fill="${fill}" fill-opacity="${op}"><title>${d.date}: ${d.contributionCount}</title></rect>`;
  }).join("");
  const gridW = Math.ceil(cells.length / 7) * (SZ + GAP);

  const range = (a, b) => (a ? `${fmtDate(a, false)} – ${fmtDate(b, false)}` : "Start one today");
  const body = `
<g class="rise" style="animation-delay:.2s">
<text x="24" y="66" font-size="10" fill="${C.muted}" letter-spacing=".8">CURRENT STREAK</text>
<g class="o flick" style="transform-origin:38px 92px">
<path d="M38 76c6 7 10 11 10 17a10 10 0 0 1-20 0c0-4 2-7 4-9 0 3 1 5 3 5-1-5 1-9 3-13z" fill="${C.amber}"/>
<path d="M38 88c3 3 4 5 4 7a4 4 0 0 1-8 0c0-2 2-4 4-7z" fill="${C.white}" fill-opacity=".85"/></g>
<text class="m" x="58" y="102" font-size="30" font-weight="800" fill="${C.white}">${s.cur.n}<tspan font-size="12" fill="${C.teal}" font-weight="600"> day${s.cur.n === 1 ? "" : "s"}</tspan></text>
<text x="24" y="122" font-size="10.5" fill="${C.text}">${esc(range(s.cur.start, s.cur.end))}</text></g>
<g class="rise" style="animation-delay:.45s">
<line x1="24" y1="136" x2="160" y2="136" stroke="${C.border}"/>
<text x="24" y="154" font-size="10" fill="${C.muted}">LONGEST</text>
<text class="m" x="160" y="154" font-size="12" font-weight="700" fill="${C.teal}" text-anchor="end">${s.longest.n} days</text>
<text x="24" y="172" font-size="10" fill="${C.muted}">LIFETIME</text>
<text class="m" x="160" y="172" font-size="12" font-weight="700" fill="${C.amber}" text-anchor="end">${fmt(s.total)}</text></g>
${grid}
<text class="m rise" style="animation-delay:1s" x="${X0}" y="${Y0 + 7 * (SZ + GAP) + 14}" font-size="9" fill="${C.muted}">${WEEKS} weeks</text>
<g transform="translate(${X0 + gridW - 78} ${Y0 + 7 * (SZ + GAP) + 6})"><g class="rise" style="animation-delay:1s">
<text class="m" x="-4" y="8" font-size="9" fill="${C.muted}" text-anchor="end">less</text>
${[[C.grid, 1], [C.tealDeep, 0.38], [C.teal, 0.6], [C.teal, 1], [C.amber, 1]].map(([f, o], i) => `<rect x="${i * 11}" y="0" width="9" height="9" rx="2" fill="${f}" fill-opacity="${o}"/>`).join("")}
<text class="m" x="58" y="8" font-size="9" fill="${C.muted}">more</text></g></g>`;

  return frame({
    title: `${LOGIN}'s contribution streak`,
    desc: `Current streak ${s.cur.n} days. Longest streak ${s.longest.n} days (${s.longest.start} to ${s.longest.end}). ${s.total} contributions since ${s.first}.`,
    label: "Contribution streak",
    extraStyle: `
.cell{transform-box:fill-box;transform-origin:center;animation:pop .5s cubic-bezier(.3,1.6,.5,1) both}@keyframes pop{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}
.hot{animation:pop .5s cubic-bezier(.3,1.6,.5,1) both,hot 2.8s ease-in-out 1.5s infinite}@keyframes hot{0%,100%{filter:none}50%{filter:drop-shadow(0 0 3px ${C.amber})}}
.flick{animation:flick 1.6s ease-in-out infinite}@keyframes flick{0%,100%{transform:scale(1) rotate(-2deg)}50%{transform:scale(1.08,1.12) rotate(3deg)}}`,
    body,
  });
}

// ---------- card 3: language spectrum ----------
function langCard({ repos }) {
  const bytes = new Map();
  for (const r of repos) for (const e of r.languages.edges) {
    const cur = bytes.get(e.node.name) || { size: 0, color: e.node.color };
    cur.size += e.size;
    bytes.set(e.node.name, cur);
  }
  const all = [...bytes.entries()].sort((a, b) => b[1].size - a[1].size);
  const sum = all.reduce((s, [, v]) => s + v.size, 0) || 1;
  let top = all.slice(0, 8);
  const rest = all.slice(8).reduce((s, [, v]) => s + v.size, 0);
  if (rest) top = [...top.slice(0, 7), ["Other", { size: rest + top[7][1].size, color: C.muted }]];

  // Spectrum bar
  let x = 24;
  const W = 432;
  const bar = top.map(([name, v], i) => {
    const w = Math.max(2, (v.size / sum) * W);
    const seg = `<rect class="seg" style="animation-delay:${(0.2 + i * 0.1).toFixed(2)}s" x="${x.toFixed(1)}" y="50" width="${(w - 1.5).toFixed(1)}" height="12" fill="${v.color || C.teal}"><title>${esc(name)}</title></rect>`;
    x += w;
    return seg;
  }).join("");

  // Equalizer-style legend: two columns of four
  const legend = top.map(([name, v], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const lx = 24 + col * 222, ly = 88 + row * 24;
    const pct = (v.size / sum) * 100;
    const meter = Math.max(3, Math.round((pct / ((top[0][1].size / sum) * 100)) * 70));
    const d = (0.5 + i * 0.08).toFixed(2);
    return `<g class="rise" style="animation-delay:${d}s">
<rect x="${lx}" y="${ly - 8}" width="9" height="9" rx="2.5" fill="${v.color || C.teal}"/>
<text x="${lx + 16}" y="${ly}" font-size="12" fill="${C.text}">${esc(name)}</text>
<rect x="${lx + 108}" y="${ly - 5}" width="70" height="4" rx="2" fill="${C.grid}"/>
<rect class="grow" style="animation-delay:${d}s" x="${lx + 108}" y="${ly - 5}" width="${meter}" height="4" rx="2" fill="${v.color || C.teal}" fill-opacity=".9"/>
<text class="m" x="${lx + 210}" y="${ly}" font-size="11" font-weight="700" fill="${C.white}" text-anchor="end">${pct < 1 ? pct.toFixed(1) : pct.toFixed(0)}%</text></g>`;
  }).join("\n");

  const body = `
<text class="m rise" x="456" y="28.5" font-size="10" fill="${C.muted}" text-anchor="end">${repos.length} repos · ${(sum / 1e6).toFixed(1)} MB</text>
<clipPath id="barClip"><rect x="24" y="50" width="${W}" height="12" rx="6"/></clipPath>
<g clip-path="url(#barClip)"><rect x="24" y="50" width="${W}" height="12" fill="${C.grid}"/>${bar}
<rect class="shine" x="24" y="50" width="60" height="12" fill="url(#beam)"/></g>
${legend}`;

  return frame({
    title: `${LOGIN}'s language spectrum`,
    desc: top.map(([n, v]) => `${n} ${((v.size / sum) * 100).toFixed(1)}%`).join(", "),
    label: "Language spectrum",
    extraStyle: `
.seg{transform-box:fill-box;transform-origin:left;animation:grow .9s cubic-bezier(.2,.7,.2,1) both}
.grow{transform-box:fill-box;transform-origin:left;animation:grow 1.1s cubic-bezier(.2,.7,.2,1) both}@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.shine{animation:shine 4.5s ease-in-out 1.5s infinite}@keyframes shine{from{transform:translateX(-80px)}to{transform:translateX(520px)}}`,
    body,
  });
}

const data = await fetchData();
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, "stats.svg"), statsCard(data));
await writeFile(join(OUT, "streak.svg"), streakCard(data));
await writeFile(join(OUT, "top-langs.svg"), langCard(data));
console.log(`Wrote stats.svg, streak.svg and top-langs.svg to ${OUT}`);
