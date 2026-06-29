// Vercel serverless function (CommonJS) — commits the edited index.html back to GitHub.
// Set these in Vercel -> your project -> Environments -> Production:
//   GITHUB_TOKEN     – GitHub token with "Contents: Read and write" on THIS repo
//   ADMIN_PASSWORD   – the shared password your team types in the admin bar
//   GH_OWNER         – the GitHub username/org that owns this repo
//   GH_REPO          – this repo's name
// Optional:
//   GH_PATH   (defaults to index.html)
//   GH_BRANCH (defaults to main)

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const OWNER  = process.env.GH_OWNER || 'salesgladextours-cmd';
  const REPO   = process.env.GH_REPO || 'collectives-faq';
  const PATH   = process.env.GH_PATH   || 'index.html';
  const BRANCH = process.env.GH_BRANCH || 'main';
  const TOKEN  = process.env.GITHUB_TOKEN;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!TOKEN || !ADMIN_PASSWORD || !OWNER || !REPO) {
    return res.status(500).json({ error: 'Server not configured: missing GITHUB_TOKEN, ADMIN_PASSWORD, GH_OWNER, or GH_REPO' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};
  const password = body.password;
  const html = body.html;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'No content received' });
  }

  const api = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + encodeURIComponent(PATH);
  const ghHeaders = {
    'Authorization': 'Bearer ' + TOKEN,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'collectives-admin',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  try {
    let sha;
    const getRes = await fetch(api + '?ref=' + encodeURIComponent(BRANCH), { headers: ghHeaders });
    if (getRes.ok) {
      const cur = await getRes.json();
      sha = cur.sha;
    } else if (getRes.status !== 404) {
      const detail = await getRes.text();
      return res.status(502).json({ error: 'GitHub read failed (' + getRes.status + '): ' + detail.slice(0, 200) });
    }

    const content = Buffer.from(html, 'utf8').toString('base64');
    const payload = {
      message: 'Content update via admin panel',
      content: content,
      branch: BRANCH
    };
    if (sha) payload.sha = sha;

    const putRes = await fetch(api, {
      method: 'PUT',
      headers: ghHeaders,
      body: JSON.stringify(payload)
    });

    if (!putRes.ok) {
      const detail = await putRes.text();
      return res.status(502).json({ error: 'GitHub write failed (' + putRes.status + '): ' + detail.slice(0, 200) });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};