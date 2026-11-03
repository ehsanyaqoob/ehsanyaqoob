// Rewrites the marked sections of README.md with live data from GitHub and the App Store.
// Needs GH_TOKEN. Run: node scripts/update-readme.mjs
import { readFileSync, writeFileSync } from "node:fs";

const LOGIN = "ehsanyaqoob";
const TALLY_APP_ID = "6814942383";
const readme = new URL("../README.md", import.meta.url);

async function github(query) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${process.env.GH_TOKEN}`, "User-Agent": LOGIN },
    body: JSON.stringify({ query }),
  });
  const body = await res.json();
  if (body.errors || !body.data) throw new Error(JSON.stringify(body));
  return body.data.user;
}

async function commitStats() {
  const { createdAt } = await github(`{ user(login: "${LOGIN}") { createdAt } }`);
  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const firstYear = new Date(createdAt).getUTCFullYear();
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => firstYear + i);
  const perYear = years
    .map((y) => {
      const to = y === thisYear ? now.toISOString() : `${y}-12-31T23:59:59Z`;
      return `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${to}") { contributionCalendar { totalContributions } }`;
    })
    .join("\n");
  const user = await github(`{ user(login: "${LOGIN}") {
    contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { contributionCount } } } }
    ${perYear}
  } }`);
  const calendar = user.contributionsCollection.contributionCalendar;
  const total = (y) => user[`y${y}`].contributionCalendar.totalContributions;
  const activeDays = calendar.weeks.flatMap((w) => w.contributionDays).filter((d) => d.contributionCount > 0).length;
  const asOf = now.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  return [
    `| Since ${firstYear} | Last 12 months | ${thisYear} so far | Active days |`,
    "| --- | --- | --- | --- |",
    `| ${years.reduce((sum, y) => sum + total(y), 0)} | ${calendar.totalContributions} | ${total(thisYear)} | ${activeDays} |`,
    "",
    `<sub>Contributions as of ${asOf}, private repositories included. Updated daily from GitHub.</sub>`,
  ].join("\n");
}

async function appStatus() {
  const res = await fetch(`https://itunes.apple.com/lookup?id=${TALLY_APP_ID}&country=us`);
  const [app] = (await res.json()).results;
  if (!app) throw new Error("Tally not found on the App Store");
  const updated = new Date(app.currentVersionReleaseDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return `Version ${app.version} on the App Store · Updated ${updated}`;
}

function fill(source, name, content) {
  const pattern = new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!pattern.test(source)) throw new Error(`Missing ${name} markers`);
  return source.replace(pattern, (_, start, end) => `${start}\n\n${content}\n\n${end}`);
}

let source = readFileSync(readme, "utf8");
source = fill(source, "stats", await commitStats());
source = fill(source, "app", await appStatus());
writeFileSync(readme, source);
