import { mkdir, writeFile } from 'node:fs/promises';

const repo = process.env.REPO;
const token = process.env.GH_TOKEN;
const envs = ['poc-dev', 'poc-stage', 'poc-prod'];

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'poc-pages',
    },
  });
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const rows = [];
for (const env of envs) {
  const deps = await gh(`/repos/${repo}/deployments?environment=${encodeURIComponent(env)}&per_page=1`);
  if (!deps.length) {
    rows.push({ env, deployed: false });
    continue;
  }
  const dep = deps[0];
  let state = 'unknown';
  let logUrl = '';
  let envUrl = '';
  const statuses = await gh(`/repos/${repo}/deployments/${dep.id}/statuses?per_page=1`);
  if (statuses.length) {
    state = statuses[0].state;
    logUrl = statuses[0].log_url || '';
    envUrl = statuses[0].environment_url || '';
  }
  let commentCount = 0;
  try {
    const comments = await gh(`/repos/${repo}/commits/${dep.sha}/comments?per_page=100`);
    commentCount = Array.isArray(comments) ? comments.length : 0;
  } catch {
    commentCount = 0;
  }
  rows.push({
    env,
    deployed: true,
    ref: dep.ref,
    sha: (dep.sha || '').slice(0, 7),
    creator: dep.creator?.login || '',
    createdAt: dep.created_at,
    state,
    logUrl,
    envUrl,
    commentCount,
  });
}

const generatedAt = new Date().toISOString();

const tbody = rows.map((r) => (r.deployed
  ? `<tr class="s-${esc(r.state)}">
      <td>${esc(r.env)}</td>
      <td>${esc(r.ref)}</td>
      <td><code>${esc(r.sha)}</code></td>
      <td>${esc(r.creator)}</td>
      <td>${esc(r.createdAt)}</td>
      <td><span class="badge">${esc(r.state)}</span></td>
      <td>${esc(r.commentCount)}</td>
      <td>${r.logUrl ? `<a href="${esc(r.logUrl)}">run</a>` : ''}</td>
    </tr>`
  : `<tr class="s-none"><td>${esc(r.env)}</td><td colspan="7">no deployment yet</td></tr>`)).join('\n');

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>deploy status</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 900px; padding: 0 1rem; }
  h1 { font-size: 1.4rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #8884; padding: .5rem .6rem; text-align: left; font-size: .9rem; }
  th { background: #8881; }
  code { font-family: ui-monospace, monospace; }
  .badge { padding: .1rem .5rem; border-radius: .5rem; background: #8882; font-size: .8rem; }
  .s-success .badge { background: #2ecc7133; }
  .s-failure .badge, .s-error .badge { background: #e74c3c33; }
  .muted { color: #8886; font-size: .8rem; }
</style>
</head>
<body>
<h1>deploy status</h1>
<p class="muted">generated at ${esc(generatedAt)} / source: ${esc(repo)}</p>
<table>
<thead><tr><th>environment</th><th>branch (ref)</th><th>sha</th><th>by</th><th>at</th><th>state</th><th>commit comments</th><th>log</th></tr></thead>
<tbody>
${tbody}
</tbody>
</table>
</body>
</html>
`;

await mkdir('_site', { recursive: true });
await writeFile('_site/index.html', html);
await writeFile('_site/status.json', JSON.stringify({ generatedAt, repo, environments: rows }, null, 2));
console.log(`wrote _site/index.html and _site/status.json (${rows.length} environments)`);
