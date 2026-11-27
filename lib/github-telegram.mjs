import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyGitHubSignature(body, signature, secret) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
const text = (v, limit = 180) => String(v ?? '').slice(0, limit).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const code = v => `<code>${text(v)}</code>`;
const link = (url, label) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? `<a href="${text(parsed.href, 500)}">${text(label)}</a>` : text(label);
  } catch { return text(label); }
};

export function formatGitHubNotification(event, p) {
  if (!p || typeof p !== 'object' || Array.isArray(p) || !p.repository?.full_name) return null;
  const internalBranch = branch => /^(automation|dependabot|renovate)\//.test(String(branch || ''));
  const header = `${link(p.repository.html_url, p.repository.full_name)} · ${text(p.sender?.login || p.pusher?.name || 'unknown')}`;
  const sha = v => code(String(v || '').slice(0, 7));
  if (event === 'workflow_run') {
    const run = p.workflow_run;
    if (p.action !== 'completed' || run?.name !== 'CI' || run.conclusion !== 'failure' || internalBranch(run.head_branch)) return null;
    return ['❌ <b>CI thất bại — vui lòng sửa và push lại</b>',
      link(p.repository.html_url, p.repository.full_name),
      `Nhánh: ${code(run.head_branch)} · ${sha(run.head_sha)}`,
      `Tác giả commit: ${text(run.head_commit?.author?.name || 'unknown', 100)}`,
      `Người chạy: ${text(run.triggering_actor?.login || run.actor?.login || p.sender?.login || 'unknown', 100)}`,
      ...(p.ci_failures || []).slice(0, 3).map(f => `${code(f.location)}\n${text(f.message, 500)}`),
      !p.ci_failures?.length ? 'Không lấy được chi tiết lỗi; xem bước thất bại trong Actions.' : '',
      link(run.html_url, 'Xem lỗi CI'),
    ].filter(Boolean).join('\n');
  }
  if (event === 'push') {
    if (!p.ref?.startsWith('refs/heads/')) return null;
    const branch = p.ref.slice(11);
    if (internalBranch(branch) || p.deleted) return null;
    const commits = Array.isArray(p.commits) ? p.commits : [];
    const actor = p.sender?.login || p.pusher?.name || 'unknown';
    const headMessage = p.head_commit?.message || commits.at(-1)?.message || '';
    if (branch === 'preview' && actor === 'github-actions[bot]' && /automation\/sync-main-|synchronize main into preview/.test(headMessage)) return null;
    const title = branch === 'preview' ? '🧪 <b>Đã lên nhánh preview</b>'
      : branch === 'main' ? '🚀 <b>Đã lên nhánh main</b>' : '📤 <b>Đã push code</b>';
    return [title, link(p.repository.html_url, p.repository.full_name),
      `Người push: ${text(actor)} → ${code(branch)}`,
      `Phiên bản: ${sha(p.after)}`,
      ...commits.slice(0, 3).map(c => `• ${text(String(c.message || '').split('\n')[0], 180)}`),
      commits.length > 3 ? `… và ${commits.length - 3} commit khác.` : '',
      p.compare ? link(p.compare, 'Xem thay đổi') : '',
    ].filter(Boolean).join('\n');
  }
  if (event === 'deployment_status') {
    const d = p.deployment, s = p.deployment_status;
    if (!d || !s || !['success', 'failure', 'error'].includes(s.state) || !['preview', 'main'].includes(d.ref)) return null;
    const branch = d.ref;
    const production = d.production_environment === true || /^production$/i.test(s.environment || d.environment || '');
    if ((branch === 'main') !== production) return null;
    if (s.state !== 'success') return [
      `❌ <b>Nhánh ${branch} build không thành công</b>`, header,
      `Phiên bản: ${sha(d.sha)}`,
      'Vui lòng kiểm tra lỗi, sửa và push lại.',
      s.log_url ? link(s.log_url, 'Xem lỗi build') : '',
    ].filter(Boolean).join('\n');
    if (branch === 'preview') return null;
    return ['✅ <b>Phiên bản mới đã sẵn sàng trên staging</b>',
      link(p.repository.html_url, p.repository.full_name), `Phiên bản: ${sha(d.sha)}`,
      link('https://tmsmindx.vercel.app/', 'Mở phiên bản mới (staging)'),
    ].join('\n');
  }
  return null;
}

// Read annotations only; never forward raw logs that might contain credentials.
/** @param {any} payload
 * @param {{ token?: string, fetchImpl?: typeof fetch }} options
 */
export async function getCIFailures(payload, { token, fetchImpl = fetch } = {}) {
  const run = payload?.workflow_run;
  if (payload?.action !== 'completed' || run?.name !== 'CI' || run.conclusion !== 'failure'
    || payload.repository?.full_name !== 'BWCbewchan/tpsmindx' || !Number.isSafeInteger(run.id)) return [];
  const api = 'https://api.github.com/repos/BWCbewchan/tpsmindx';
  const read = async path => {
    const response = await fetchImpl(`${api}${path}`, {
      headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error('CI metadata unavailable');
    return response.json();
  };
  try {
    const jobs = await read(`/actions/runs/${run.id}/attempts/${Number.isSafeInteger(run.run_attempt) ? run.run_attempt : 1}/jobs?per_page=100`);
    const failures = [];
    for (const job of (jobs.jobs || []).filter(j => j.conclusion === 'failure').slice(0, 2)) {
      const checkId = /\/check-runs\/(\d+)$/.exec(job.check_run_url || '')?.[1];
      if (checkId) {
        try {
          const annotations = await read(`/check-runs/${checkId}/annotations?per_page=100`);
          for (const a of annotations.filter(a => a.annotation_level === 'failure').slice(0, 3)) {
            failures.push({ location: `${a.path || job.name}${a.start_line ? `:${a.start_line}` : ''}`, message: a.message || a.title || 'CI failed' });
          }
        } catch { /* Keep a useful job/step fallback when annotations are unavailable. */ }
      }
      if (!failures.length) failures.push({ location: job.name,
        message: `Bước thất bại: ${(job.steps || []).filter(s => s.conclusion === 'failure').map(s => s.name).join(', ') || 'Xem Actions'}` });
    }
    return failures.slice(0, 3);
  } catch { return []; }
}
