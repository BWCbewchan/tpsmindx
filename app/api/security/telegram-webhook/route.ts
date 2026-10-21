import pool from '@/lib/db';
import { unblockIp } from '@/lib/brute-force-guard';
import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram-delivery.mjs';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    title?: string;
    type: string;
  };
  date: number;
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  message?: {
    message_id: number;
    chat: {
      id: number;
    };
    text?: string;
  };
  data?: string;
}

interface TelegramWebhookBody {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

/** Gửi phản hồi ngược lại nhóm Telegram */
async function sendTelegramReply(chatId: number, text: string, replyToMessageId?: number): Promise<void> {
  await sendTelegramMessage({ token: TELEGRAM_BOT_TOKEN, chatId, text,
    parseMode: 'Markdown', replyToMessageId });
}

/** Trả lời callback query của Telegram */
async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });
}

/** Chỉnh sửa tin nhắn hiện có trên Telegram */
async function editMessageText(chatId: number, messageId: number, text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`;
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
    }),
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!TELEGRAM_BOT_TOKEN || !AUTHORIZED_CHAT_ID || !TELEGRAM_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Telegram environment variables not configured' }, { status: 500 });
    }

    const secretHeader = request.headers.get('x-telegram-bot-api-secret-token') || '';
    if (secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as TelegramWebhookBody;

    // ── XỬ LÝ INTERACTIVE BUTTONS (CALLBACK QUERY) ──
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = cb.message?.chat.id;
      const messageId = cb.message?.message_id;
      const data = cb.data;
      const callbackQueryId = cb.id;

      // 🔒 BẢO MẬT: Chỉ xử lý callback từ đúng Group/Chat được phân quyền
      if (!chatId || String(chatId) !== String(AUTHORIZED_CHAT_ID)) {
        console.warn(`[TelegramWebhook] Unauthorized callback chat attempt: ${chatId}`);
        return NextResponse.json({ success: true, message: 'Unauthorized callback chat ID ignored' });
      }

      if (data && messageId) {
        const parts = data.split(':');
        const action = parts[0];
        const targetIp = parts[1];

        if (targetIp) {
          if (action === 'tgblock') {
            const { blockIp } = await import('@/lib/brute-force-guard');
            await blockIp(targetIp);

            // Ghi nhận vào audit log
            const { writeAuditLog } = await import('@/lib/audit-logger');
            writeAuditLog({
              event_type: 'SYSTEM',
              action: 'TELEGRAM_BUTTON_IP_BLOCK',
              severity: 'WARNING',
              user_email: cb.from.username ? `@${cb.from.username}` : cb.from.first_name,
              resource_type: 'security_threat_tracking',
              resource_id: targetIp,
              new_data: { blocked_ip: targetIp, action_source: 'telegram_inline_button' },
            });

            // Cập nhật lại tin nhắn cảnh báo gốc
            const originalText = cb.message?.text ?? '';
            const updatedText = `${originalText}\n\n🛡️ *Đã xử lý:* IP \`${targetIp}\` đã bị *KHÓA* thủ công bởi Admin *${cb.from.first_name}* lúc ${new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`;
            await editMessageText(chatId, messageId, updatedText);
            await answerCallbackQuery(callbackQueryId, `Đã khóa thành công IP ${targetIp}`);
          }
          
          else if (action === 'tgunblock') {
            await unblockIp(targetIp);

            // Ghi nhận vào audit log
            const { writeAuditLog } = await import('@/lib/audit-logger');
            writeAuditLog({
              event_type: 'SYSTEM',
              action: 'TELEGRAM_BUTTON_IP_UNBLOCK',
              severity: 'INFO',
              user_email: cb.from.username ? `@${cb.from.username}` : cb.from.first_name,
              resource_type: 'security_threat_tracking',
              resource_id: targetIp,
              new_data: { unblocked_ip: targetIp, action_source: 'telegram_inline_button' },
            });

            // Cập nhật lại tin nhắn cảnh báo gốc
            const originalText = cb.message?.text ?? '';
            const updatedText = `${originalText}\n\n🔓 *Đã xử lý:* IP \`${targetIp}\` đã được *MỞ KHÓA* bởi Admin *${cb.from.first_name}* lúc ${new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`;
            await editMessageText(chatId, messageId, updatedText);
            await answerCallbackQuery(callbackQueryId, `Đã mở khóa thành công IP ${targetIp}`);
          }
        }
      }

      return NextResponse.json({ success: true });
    }

    const message = body.message;

    if (!message || !message.text) {
      return NextResponse.json({ success: true, message: 'No text message received' });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const messageId = message.message_id;

    // 🔒 BẢO MẬT: Chỉ xử lý lệnh từ đúng Group/Chat được phân quyền
    if (String(chatId) !== String(AUTHORIZED_CHAT_ID)) {
      console.warn(`[TelegramWebhook] Unauthorized chat attempt: ${chatId}`);
      return NextResponse.json({ success: true, message: 'Unauthorized chat ID ignored' });
    }

    // Phân tích câu lệnh
    const parts = text.split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    // Bỏ hậu tố bot (ví dụ /status@TpsLog_bot -> /status)
    const baseCommand = command.split('@')[0];

    switch (baseCommand) {
      case '/help':
      case '/start': {
        const reply = [
          '🤖 *BOT GIÁM SÁT BẢO MẬT — TMS MINDX*',
          '',
          'Bạn có thể tương tác trực tiếp với hệ thống bảo mật bằng các câu lệnh dưới đây:',
          '',
          '📊 `/status` - Xem trạng thái bảo mật hiện tại của hệ thống.',
          '🚨 `/threats` - Xem danh sách địa chỉ IP đang bị khóa (block) do brute force.',
          '🔓 `/unblock <ip>` - Mở khóa truy cập cho một địa chỉ IP cụ thể.',
          '📝 `/summary` - Báo cáo tổng hợp nhanh các sự kiện bảo mật trong 24 giờ qua.',
          '❓ `/help` - Xem hướng dẫn sử dụng và danh sách câu lệnh.',
          '',
          '⚠️ *Lưu ý:* Bot chỉ phản hồi các yêu cầu từ nhóm quản trị được ủy quyền.',
        ].join('\n');
        
        await sendTelegramReply(chatId, reply, messageId);
        break;
      }

      case '/status': {
        // Query số lượng logs bảo mật (24h)
        const logCountRes = await pool.query(
          `SELECT COUNT(*) FROM public.security_audit_logs WHERE created_at > NOW() - INTERVAL '24 hours'`
        );
        const logCount = logCountRes.rows[0]?.count ?? 0;

        // Query số lượng IP bị block
        const blockedCountRes = await pool.query(
          `SELECT COUNT(*) FROM public.security_threat_tracking WHERE is_blocked = true AND (blocked_until IS NULL OR blocked_until > NOW())`
        );
        const blockedCount = blockedCountRes.rows[0]?.count ?? 0;

        // Query thống kê mức độ nghiêm trọng
        const severityRes = await pool.query(
          `SELECT severity, COUNT(*) FROM public.security_audit_logs 
           WHERE created_at > NOW() - INTERVAL '24 hours' 
           GROUP BY severity`
        );
        
        let critical = 0, high = 0, warning = 0;
        for (const row of severityRes.rows) {
          if (row.severity === 'CRITICAL') critical = parseInt(row.count, 10);
          if (row.severity === 'HIGH')     high = parseInt(row.count, 10);
          if (row.severity === 'WARNING')  warning = parseInt(row.count, 10);
        }

        // Query số bảng chưa bật RLS (trong schema public, không tính các bảng hệ thống/view)
        const rlsRes = await pool.query(
          `SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false`
        );
        const disabledRlsCount = rlsRes.rows[0]?.count ?? 0;

        const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        const reply = [
          '📊 *TRẠNG THÁI HỆ THỐNG BẢO MẬT*',
          '🏢 *App:* https://www.tpsmindx.com/',
          '',
          '🛡️ *Thông số giám sát:*',
          `- Số bảng chưa bật RLS: \`${disabledRlsCount}\` ${disabledRlsCount === '0' ? '✅' : '⚠️'}`,
          `- Số logs bảo mật (24h qua): \`${logCount}\``,
          `- Số IP đang bị block: \`${blockedCount}\` ${blockedCount > 0 ? '🔴' : '🟢'}`,
          '',
          '⚠️ *Sự kiện nghi vấn gần đây (24h qua):*',
          `- Nghiêm trọng (CRITICAL): \`${critical}\` ${critical > 0 ? '🚨' : '✅'}`,
          `- Nguy hiểm (HIGH): \`${high}\` ${high > 0 ? '🔴' : '✅'}`,
          `- Cảnh báo (WARNING): \`${warning}\` ${warning > 0 ? '🟡' : '✅'}`,
          '',
          `🕐 *Thời gian cập nhật:* \`${now}\``,
        ].join('\n');

        await sendTelegramReply(chatId, reply, messageId);
        break;
      }

      case '/threats': {
        const threatsRes = await pool.query<{
          ip_address: string;
          threat_type: string;
          attempt_count: number;
          blocked_until: string;
        }>(
          `SELECT ip_address, threat_type, attempt_count, blocked_until 
           FROM public.security_threat_tracking 
           WHERE is_blocked = true AND (blocked_until IS NULL OR blocked_until > NOW())
           ORDER BY blocked_until DESC
           LIMIT 10`
        );

        if (threatsRes.rows.length === 0) {
          await sendTelegramReply(chatId, '🚨 *Hệ thống an toàn:* Hiện tại không có địa chỉ IP nào đang bị khóa.', messageId);
          break;
        }

        const listLines = threatsRes.rows.map((row, index) => {
          const until = new Date(row.blocked_until).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
          return `${index + 1}. 🌐 *IP:* \`${row.ip_address}\`\n    ⚠️ *Loại:* \`${row.threat_type}\` | 🔢 *Thử:* \`${row.attempt_count} lần\`\n    🕒 *Mở khóa:* \`${until}\``;
        }).join('\n\n');

        const reply = [
          '🚨 *DANH SÁCH ĐỊA CHỈ IP ĐANG BỊ KHÓA*',
          '',
          listLines,
          '',
          '💡 Để gỡ chặn cho một IP cụ thể, hãy dùng lệnh:',
          '👉 `/unblock <địa_chỉ_ip>`',
        ].join('\n');

        await sendTelegramReply(chatId, reply, messageId);
        break;
      }

      case '/unblock': {
        const targetIp = args[0];
        if (!targetIp) {
          await sendTelegramReply(chatId, '⚠️ Vui lòng cung cấp địa chỉ IP cần gỡ chặn.\nCú pháp: `/unblock 1.2.3.4`', messageId);
          break;
        }

        // Kiểm tra xem IP có tồn tại trong danh sách block không
        const checkRes = await pool.query(
          'SELECT id FROM public.security_threat_tracking WHERE ip_address = $1 AND is_blocked = true',
          [targetIp]
        );

        if (checkRes.rows.length === 0) {
          await sendTelegramReply(chatId, `❌ *Lỗi:* Không tìm thấy địa chỉ IP \`${targetIp}\` trong danh sách đang bị block.`, messageId);
          break;
        }

        await unblockIp(targetIp);

        // Ghi nhận hành động gỡ block vào audit log
        const { writeAuditLog } = await import('@/lib/audit-logger');
        writeAuditLog({
          event_type: 'SYSTEM',
          action: 'TELEGRAM_IP_UNBLOCK',
          severity: 'INFO',
          user_email: message.from?.username ? `@${message.from.username}` : message.from?.first_name ?? 'Telegram Admin',
          resource_type: 'security_threat_tracking',
          resource_id: targetIp,
          new_data: { unblocked_ip: targetIp, action_source: 'telegram_command' },
        });

        const reply = [
          '✅ *GỠ BỎ KHÓA TRUY CẬP THÀNH CÔNG*',
          '',
          `🌐 *Địa chỉ IP:* \`${targetIp}\``,
          `🛡️ *Người thực hiện:* ${message.from?.first_name} ${message.from?.username ? `(@${message.from.username})` : ''}`,
          '',
          'Trạng thái truy cập của IP này đã được khôi phục bình thường ở hệ thống.',
        ].join('\n');

        await sendTelegramReply(chatId, reply, messageId);
        break;
      }

      case '/summary': {
        // Query thống kê loại sự kiện
        const eventTypeRes = await pool.query(
          `SELECT event_type, COUNT(*) FROM public.security_audit_logs 
           WHERE created_at > NOW() - INTERVAL '24 hours' 
           GROUP BY event_type`
        );

        const typesMap: Record<string, string> = {
          AUTH: '🔐 Đăng nhập',
          DATA_MUTATION: '📝 Thay đổi dữ liệu',
          PRIVILEGE_ESCALATION: '⚡ Leo thang đặc quyền',
          SENSITIVE_DATA_ACCESS: '👁️ Truy cập nhạy cảm',
          SYSTEM: '⚙️ Hệ thống',
          GENERAL: 'ℹ️ Chung',
        };

        const typeLines = eventTypeRes.rows.map(row => {
          const label = typesMap[row.event_type] ?? row.event_type;
          return `- ${label}: \`${row.count} lần\``;
        }).join('\n') || '- Không có sự kiện nào được ghi nhận.';

        // Query danh sách các hoạt động chi tiết gần đây (24h qua) để hiển thị chi tiết người dùng
        const detailsRes = await pool.query<{
          event_type: string;
          action: string;
          user_email: string | null;
          ip_address: string | null;
          endpoint: string | null;
          resource_type: string | null;
          resource_id: string | null;
          created_at: string;
          severity: string;
        }>(
          `SELECT event_type, action, user_email, ip_address, endpoint, resource_type, resource_id, created_at, severity
           FROM public.security_audit_logs
           WHERE created_at > NOW() - INTERVAL '24 hours'
           ORDER BY created_at DESC
           LIMIT 5`
        );

        const detailsLines = detailsRes.rows.map((row, idx) => {
          const time = new Date(row.created_at).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
          const icon = typesMap[row.event_type]?.split(' ')[0] ?? 'ℹ️';
          const missingActorLog = !row.user_email && row.event_type === 'DATA_MUTATION';
          const userStr = row.user_email
            ? `\`${row.user_email}\``
            : missingActorLog
              ? '`audit-system@tps.internal`'
              : row.event_type === 'SYSTEM'
                ? '_system-event_'
                : '_invalid-session-email_';
          const ipStr = row.ip_address && row.ip_address !== 'unknown' ? ` (IP: \`${row.ip_address}\`)` : '';
          const endpointStr = row.endpoint ? ` | Endpoint: \`${row.endpoint}\`` : '';
          const resourceStr = row.resource_type ? ` | Resource: \`${row.resource_type}${row.resource_id ? `#${row.resource_id}` : ''}\`` : '';
          const actionStr = missingActorLog ? `AUDIT_MISSING_ACTOR(${row.action})` : row.action;
          const severityTag = ['HIGH', 'CRITICAL'].includes(row.severity) ? ` [🔴 ${row.severity}]` : '';

          return `${idx + 1}. ${icon} *${actionStr}* bởi ${userStr}${severityTag} lúc \`${time}\`${ipStr}${endpointStr}${resourceStr}`;
        }).join('\n') || '_Không có hoạt động nào được ghi nhận._';

        // Query sự kiện HIGH/CRITICAL gần nhất
        const recentRes = await pool.query<{
          event_type: string;
          action: string;
          user_email: string | null;
          severity: string;
          created_at: string;
        }>(
          `SELECT event_type, action, user_email, severity, created_at 
           FROM public.security_audit_logs 
           WHERE severity IN ('HIGH', 'CRITICAL') AND created_at > NOW() - INTERVAL '24 hours'
           ORDER BY created_at DESC
           LIMIT 3`
        );

        const recentLines = recentRes.rows.map((row, idx) => {
          const time = new Date(row.created_at).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
          const sevIcon = row.severity === 'CRITICAL' ? '🚨' : '🔴';
          const actor = row.user_email ?? (row.event_type === 'SYSTEM' ? 'system-event' : 'invalid-session-email');
          return `${idx + 1}. ${sevIcon} [${row.severity}] *${row.action}*\n    👤 Đối tượng: \`${actor}\` | 🕐 Lúc: \`${time}\``;
        }).join('\n\n') || '🟢 Không phát hiện sự cố nghiêm trọng nào.';

        const reply = [
          '📝 *TỔNG HỢP LOG BẢO MẬT (24H QUA)*',
          '',
          '📊 *Thống kê theo phân loại:*',
          typeLines,
          '',
          '👥 *Danh sách hoạt động chi tiết:*',
          detailsLines,
          '',
          '🔴 *Sự cố nghiêm trọng gần nhất:*',
          recentLines,
        ].join('\n');

        await sendTelegramReply(chatId, reply, messageId);
        break;
      }

      default:
        // Phớt lờ nếu không phải lệnh hỗ trợ
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[TelegramWebhook] Error processing update:', error);
    return NextResponse.json({ error: 'Server error processing webhook' }, { status: 500 });
  }
}
