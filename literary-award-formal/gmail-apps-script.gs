/**
 * 競賽評審管理平台｜Gmail 免費寄信橋接
 * 使用 Google Apps Script + GmailApp，不需要付費 Email API。
 *
 * 設定：
 * 1. 把 BRIDGE_SECRET 改成系統「郵件中心」產生的連線金鑰。
 * 2. 執行 authorizeOnce() 一次，授權 Gmail 與時間觸發器。
 * 3. 部署為 Web app：Execute as「Me」、Who has access「Anyone」。
 * 4. 把 /exec 網址貼回系統郵件中心。
 */

const BRIDGE_SECRET = '請貼上系統產生的連線金鑰';
const QUEUE_PREFIX = 'MAIL_SCHEDULE_';
const HISTORY_PREFIX = 'MAIL_HISTORY_';

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function authorizeOnce() {
  GmailApp.getDrafts();
  MailApp.getRemainingDailyQuota();
  ensureScheduler_();
  return '授權完成';
}

function doGet() {
  return json_({ ok: true, service: 'Gmail Apps Script Bridge' });
}

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!req || req.secret !== BRIDGE_SECRET || BRIDGE_SECRET.indexOf('請貼上') === 0) {
      return json_({ ok: false, error: '驗證失敗' });
    }

    switch (String(req.action || 'status')) {
      case 'status':
        return json_({
          ok: true,
          gmail_address: Session.getEffectiveUser().getEmail(),
          remaining_daily_quota: MailApp.getRemainingDailyQuota(),
          scheduler_ready: ensureScheduler_(),
          timezone: Session.getScriptTimeZone()
        });
      case 'draft':
        return json_(handleMessages_(req.messages || [], 'draft', null));
      case 'send':
        return json_(handleMessages_(req.messages || [], 'send', null));
      case 'schedule':
        return json_(handleMessages_(req.messages || [], 'schedule', req.scheduled_for));
      case 'cancel':
        return json_(cancelSchedules_(req.schedule_ids || [], !!req.delete_drafts));
      case 'scheduled':
        return json_(listScheduled_());
      default:
        return json_({ ok: false, error: '不支援的操作' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function handleMessages_(messages, mode, scheduledFor) {
  if (!Array.isArray(messages) || !messages.length) {
    return { ok: false, error: '沒有郵件資料', results: [] };
  }
  if (messages.length > 100) {
    return { ok: false, error: '單批最多 100 封', results: [] };
  }

  let sendAt = null;
  if (mode === 'schedule') {
    sendAt = new Date(scheduledFor);
    if (isNaN(sendAt.getTime()) || sendAt.getTime() <= Date.now()) {
      return { ok: false, error: '排程時間必須晚於現在', results: [] };
    }
    ensureScheduler_();
  }

  const props = PropertiesService.getScriptProperties();
  const results = [];

  messages.forEach((m, index) => {
    try {
      const to = String(m.to || '').trim();
      const subject = String(m.subject || '').slice(0, 500);
      const body = String(m.body || '');
      if (!to || !subject) throw new Error('收件人或主旨空白');

      const options = {};
      if (m.html_body) options.htmlBody = String(m.html_body);
      if (m.reply_to) options.replyTo = String(m.reply_to);
      if (m.name) options.name = String(m.name);

      const draft = GmailApp.createDraft(to, subject, body, options);
      const draftId = draft.getId();

      if (mode === 'draft') {
        results.push({ index, ok: true, status: 'draft', draft_id: draftId });
        return;
      }

      if (mode === 'send') {
        const sent = draft.send();
        results.push({
          index, ok: true, status: 'sent',
          draft_id: draftId,
          message_id: sent.getId()
        });
        return;
      }

      const scheduleId = Utilities.getUuid();
      props.setProperty(QUEUE_PREFIX + scheduleId, JSON.stringify({
        id: scheduleId,
        draft_id: draftId,
        to,
        send_at: sendAt.toISOString(),
        created_at: new Date().toISOString()
      }));
      results.push({
        index, ok: true, status: 'scheduled',
        draft_id: draftId,
        schedule_id: scheduleId,
        scheduled_for: sendAt.toISOString()
      });
    } catch (err) {
      results.push({
        index, ok: false, status: 'failed',
        error: String(err && err.message ? err.message : err)
      });
    }
  });

  return {
    ok: results.every(x => x.ok),
    results,
    remaining_daily_quota: MailApp.getRemainingDailyQuota()
  };
}

function processScheduledMail() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;

  try {
    const props = PropertiesService.getScriptProperties();
    const all = props.getProperties();
    const now = Date.now();

    Object.keys(all)
      .filter(k => k.indexOf(QUEUE_PREFIX) === 0)
      .forEach(key => {
        let item;
        try {
          item = JSON.parse(all[key]);
          if (new Date(item.send_at).getTime() > now) return;

          const draft = GmailApp.getDraft(item.draft_id);
          const sent = draft.send();

          props.deleteProperty(key);
          props.setProperty(HISTORY_PREFIX + item.id, JSON.stringify({
            id: item.id,
            status: 'sent',
            to: item.to,
            sent_at: new Date().toISOString(),
            message_id: sent.getId()
          }));
        } catch (err) {
          if (!item) return;
          props.deleteProperty(key);
          props.setProperty(HISTORY_PREFIX + item.id, JSON.stringify({
            id: item.id,
            status: 'failed',
            to: item.to,
            failed_at: new Date().toISOString(),
            error: String(err && err.message ? err.message : err)
          }));
        }
      });

    pruneHistory_();
  } finally {
    lock.releaseLock();
  }
}

function listScheduled_() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const pending = [];
  const history = [];

  Object.keys(props).forEach(key => {
    try {
      if (key.indexOf(QUEUE_PREFIX) === 0) pending.push(JSON.parse(props[key]));
      if (key.indexOf(HISTORY_PREFIX) === 0) history.push(JSON.parse(props[key]));
    } catch (_) {}
  });

  pending.sort((a,b) => String(a.send_at).localeCompare(String(b.send_at)));
  history.sort((a,b) => String(b.sent_at || b.failed_at || '').localeCompare(String(a.sent_at || a.failed_at || '')));

  return {
    ok: true,
    pending,
    history: history.slice(0, 200),
    remaining_daily_quota: MailApp.getRemainingDailyQuota()
  };
}

function cancelSchedules_(ids, deleteDrafts) {
  const props = PropertiesService.getScriptProperties();
  const results = [];

  (ids || []).forEach(id => {
    const key = QUEUE_PREFIX + id;
    const raw = props.getProperty(key);
    if (!raw) {
      results.push({ id, ok: false, error: '找不到排程' });
      return;
    }

    try {
      const item = JSON.parse(raw);
      props.deleteProperty(key);
      if (deleteDrafts && item.draft_id) {
        try { GmailApp.getDraft(item.draft_id).deleteDraft(); } catch (_) {}
      }
      props.setProperty(HISTORY_PREFIX + id, JSON.stringify({
        id,
        status: 'cancelled',
        to: item.to,
        cancelled_at: new Date().toISOString()
      }));
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: String(err) });
    }
  });

  return { ok: results.every(x => x.ok), results };
}

function ensureScheduler_() {
  const exists = ScriptApp.getProjectTriggers()
    .some(t => t.getHandlerFunction() === 'processScheduledMail');

  if (!exists) {
    ScriptApp.newTrigger('processScheduledMail')
      .timeBased()
      .everyMinutes(1)
      .create();
  }
  return true;
}

function pruneHistory_() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const keys = Object.keys(all).filter(k => k.indexOf(HISTORY_PREFIX) === 0);
  if (keys.length <= 200) return;

  const sorted = keys.map(k => {
    let x = {};
    try { x = JSON.parse(all[k]); } catch (_) {}
    return { key: k, time: String(x.sent_at || x.failed_at || x.cancelled_at || '') };
  }).sort((a,b) => b.time.localeCompare(a.time));

  sorted.slice(200).forEach(x => props.deleteProperty(x.key));
}
