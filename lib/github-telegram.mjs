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
  const header = `${link(p.repository.html_url, p.repository.full_name)} · ${text(p.sender?.login || p.pusher?.name || 'unknown')}`;
  const sha = v => code(String(v || '').slice(0, 7));
  if (event === 'push') {
    if (!p.ref?.startsWith('refs/heads/')) return null;
    const branch = p.ref.slice(11);
    const release = ['preview', 'main'].includes(branch);
    const commits = Array.isArray(p.commits) ? p.commits : [];
    const actor = p.sender?.login || p.pusher?.name || 'unknown';
    return [release ? `🔄 <b>Nhánh ${text(branch)} có thay đổi</b>` : '📤 <b>Đã push code</b>',
      link(p.repository.html_url, p.repository.full_name),
      `Người push: ${text(actor)} → ${code(branch)}`,
      p.deleted ? 'Đã xóa nhánh.' : `Phiên bản: ${sha(p.after)}`,
      ...commits.slice(0, 5).map(c => `• ${sha(c.id)} ${text(String(c.message || '').split('\n')[0], 180)} · ${text(c.author?.name || 'unknown', 60)}`),
      commits.length > 5 ? `… và ${commits.length - 5} commit khác.` : '',
      p.compare ? link(p.compare, 'Xem toàn bộ thay đổi') : '',
      release && !p.deleted ? 'Chờ kết quả build từ Vercel.' : '',
    ].filter(Boolean).join('\n');
  }
  if (event === 'pull_request') {
    const pr = p.pull_request;
    if (!pr || !['preview', 'main'].includes(pr.base?.ref)) return null;
    const actions = { opened: '📬 Mở PR', reopened: '📬 Mở lại PR', synchronize: '🔄 Cập nhật PR', ready_for_review: '👀 PR sẵn sàng duyệt', converted_to_draft: '📝 Chuyển PR sang nháp', closed: pr.merged ? '✅ Đã merge PR' : null };
    if (!actions[p.action]) return null;
    const release = pr.head?.ref === 'preview' && pr.base?.ref === 'main';
    return [`<b>${actions[p.action]}${release ? ' phát hành' : ''}</b>`, header,
      link(pr.html_url, `#${pr.number} ${String(pr.title || '').slice(0, 160)}`), `${code(pr.head?.ref)} → ${code(pr.base?.ref)} · ${sha(pr.head?.sha)}`,
      pr.merged ? 'Đã hợp nhất. Chờ kết quả deploy từ Vercel.' : '',
    ].filter(Boolean).join('\n');
  }
  if (event === 'deployment_status') {
    const d = p.deployment, s = p.deployment_status;
    if (!d || !s || s.state !== 'success' || !['preview', 'main'].includes(d.ref)) return null;
    const branch = d.ref;
    const production = d.production_environment === true || /^production$/i.test(s.environment || d.environment || '');
    if ((branch === 'main') !== production) return null;
    return [`✅ <b>Nhánh ${branch} build thành công</b>`, header,
      `Phiên bản: ${sha(d.sha)}`,
      branch === 'main'
        ? '🚀 Phiên bản tiếp theo đã sẵn sàng sử dụng trên Production.'
        : '🧪 Phiên bản tiếp theo đã sẵn sàng chạy thử trên Preview; có thể tiếp tục đưa lên main.',
      s.environment_url ? link(s.environment_url, branch === 'main' ? 'Mở phiên bản mới' : 'Chạy thử phiên bản mới') : '',
    ].filter(Boolean).join('\n');
  }
  return null;
}
