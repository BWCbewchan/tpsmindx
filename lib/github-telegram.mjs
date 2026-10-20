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
const states = { queued: '⏳ Đang chờ', pending: '⏳ Đang chờ', requested: '⏳ Đang chờ', in_progress: '🔄 Đang chạy', success: '✅ Thành công', failure: '❌ Thất bại', error: '❌ Lỗi', cancelled: '🚫 Đã hủy', timed_out: '⌛ Hết thời gian', skipped: '⏭️ Bỏ qua', neutral: 'ℹ️ Trung lập', action_required: '⚠️ Cần xử lý', stale: '⚠️ Hết hiệu lực', startup_failure: '❌ Không khởi chạy được' };

export function formatGitHubNotification(event, p) {
  if (!p || typeof p !== 'object' || Array.isArray(p) || !p.repository?.full_name) return null;
  const header = `${link(p.repository.html_url, p.repository.full_name)} · ${text(p.sender?.login || p.pusher?.name || 'unknown')}`;
  const sha = v => code(String(v || '').slice(0, 7));
  if (event === 'push') {
    if (typeof p.ref !== 'string') return null;
    const branch = code(p.ref.replace(/^refs\/(heads|tags)\//, ''));
    if (p.deleted) return `🗑️ <b>Xóa nhánh/tag</b> ${branch}\n${header}`;
    const commits = Array.isArray(p.commits) ? p.commits : [];
    if (!commits.length) return p.created ? `🌿 <b>Tạo nhánh/tag</b> ${branch}\n${header}` : null;
    return [`📤 <b>Push ${commits.length} commit</b> → ${branch}`, header,
      ...commits.slice(0, 5).map(c => `• ${link(c.url, String(c.id || '').slice(0, 7))} ${text(String(c.message || '').split('\n')[0], 160)}`),
      commits.length > 5 ? link(p.compare, 'Xem toàn bộ commit') : '',
    ].filter(Boolean).join('\n');
  }
  if (event === 'pull_request') {
    const pr = p.pull_request;
    if (!pr) return null;
    const actions = { opened: '📬 Mở PR', reopened: '📬 Mở lại PR', synchronize: '🔄 Cập nhật PR', ready_for_review: '👀 PR sẵn sàng duyệt', converted_to_draft: '📝 Chuyển PR sang nháp', closed: pr.merged ? '✅ Đã merge PR' : '🚫 Đóng PR' };
    if (!actions[p.action]) return null;
    const release = pr.head?.ref === 'preview' && pr.base?.ref === 'main';
    return [`<b>${actions[p.action]}${release ? ' phát hành' : ''}</b>`, header,
      link(pr.html_url, `#${pr.number} ${String(pr.title || '').slice(0, 160)}`), `${code(pr.head?.ref)} → ${code(pr.base?.ref)} · ${sha(pr.head?.sha)}`,
      pr.merged ? 'Đã hợp nhất. Chờ kết quả deploy từ Vercel.' : '',
    ].filter(Boolean).join('\n');
  }
  if (event === 'workflow_run') {
    const r = p.workflow_run;
    if (!r || !['requested', 'in_progress', 'completed'].includes(p.action)) return null;
    // The reconciliation timer is routine housekeeping; report its failures only.
    if (r.name === 'Automatic delivery' && r.event === 'schedule'
      && (p.action !== 'completed' || r.conclusion === 'success')) return null;
    const state = r.conclusion || r.status;
    return [`<b>CI · ${states[state] || text(state)}</b>`, header, `${text(r.name)} · #${text(r.run_number)} · lần thử ${text(r.run_attempt || 1)}`,
      `${code(r.head_branch)} · ${sha(r.head_sha)}`, link(r.html_url, 'Xem CI / log lỗi')].join('\n');
  }
  if (event === 'deployment_status') {
    const d = p.deployment, s = p.deployment_status;
    if (!d || !s || s.state === 'inactive') return null;
    const env = s.environment || d.environment || 'Không rõ môi trường';
    const production = d.production_environment === true || /^production$/i.test(env);
    return [`<b>Deploy ${production ? 'Production' : text(env)} · ${states[s.state] || text(s.state)}</b>`, header,
      `${code(d.ref)} · ${sha(d.sha)}`, text(s.description, 300),
      s.environment_url ? link(s.environment_url, 'Mở bản deploy') : '',
      s.log_url || s.target_url ? link(s.log_url || s.target_url, 'Xem log deploy') : '',
      s.state === 'success' && !production ? 'Preview đã deploy thành công. Trạng thái merge được báo riêng qua PR.' : '',
    ].filter(Boolean).join('\n');
  }
  return null;
}
