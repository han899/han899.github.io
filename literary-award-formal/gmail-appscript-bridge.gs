/**
 * 競賽評審管理平台－免費 Gmail Bridge
 * 使用 Google Apps Script + GmailApp，不需要第三方付費寄信 API。
 *
 * 安裝：
 * 1. 在 Apps Script「專案設定 > 指令碼屬性」新增 BRIDGE_SECRET。
 * 2. 手動執行 authorizeGmailBridge() 一次並授權 Gmail。
 * 3. 部署為 Web app：
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. 把 /exec 網址與同一組 BRIDGE_SECRET 填回系統「郵件中心」。
 */

const JOB_PREFIX = 'LITERARY_MAIL_JOB_';
const HANDLER = 'processScheduledMail';

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSecret_() {
  return PropertiesService.getScriptProperties().getProperty('BRIDGE_SECRET') || '';
}

function authorizeGmailBridge() {
  // 觸發 Gmail 權限授權；不會寄信。
  GmailApp.getDrafts();
  const status = bridgeStatus_();
  Logger.log(JSON.stringify(status));
  return status;
}

function doGet() {
  return json_({ok:true, service:'Competition Gmail Bridge', message:'Use POST.'});
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const secret = getSecret_();
    if (!secret || String(payload.secret || '') !== secret) {
      return json_({ok:false, error:'連線密鑰不正確。'});
    }

    const action = String(payload.action || 'status');
    if (action === 'status') return json_(bridgeStatus_());
    if (action === 'draft') return json_(createDrafts_(payload.messages || []));
    if (action === 'send') return json_(sendNow_(payload.messages || []));
    if (action === 'schedule') return json_(scheduleDrafts_(payload.messages || [], payload.scheduled_for));
    if (action === 'cancel') return json_(cancelScheduled_(payload.schedule_ids || [], !!payload.delete_drafts));
    if (action === 'scheduled') return json_(listScheduled_());

    return json_({ok:false, error:'不支援的操作。'});
  } catch (err) {
    return json_({ok:false, error:String(err && err.message ? err.message : err)});
  }
}

function bridgeStatus_() {
  return {
    ok:true,
    gmail_address:Session.getEffectiveUser().getEmail() || '',
    timezone:Session.getScriptTimeZone(),
    remaining_daily_quota:MailApp.getRemainingDailyQuota(),
    scheduled_count:getJobs_().filter(j => j.status === 'scheduled').length
  };
}

function mailOptions_(m) {
  const o = {};
  if (m.name) o.name = String(m.name);
  if (m.reply_to) o.replyTo = String(m.reply_to);
  if (m.html_body) o.htmlBody = String(m.html_body);
  return o;
}

function normalizeMessages_(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(0, 100).map((m, index) => ({
    index,
    to:String(m.to || '').trim(),
    subject:String(m.subject || '').slice(0, 250),
    body:String(m.body || ''),
    name:String(m.name || ''),
    reply_to:String(m.reply_to || ''),
    html_body:String(m.html_body || '')
  })).filter(m => m.to);
}

function createDrafts_(messages) {
  const list = normalizeMessages_(messages);
  const results = [];
  list.forEach(m => {
    try {
      const draft = GmailApp.createDraft(m.to, m.subject, m.body, mailOptions_(m));
      results.push({index:m.index, ok:true, status:'draft', draft_id:draft.getId()});
    } catch (err) {
      results.push({index:m.index, ok:false, status:'failed', error:String(err && err.message ? err.message : err)});
    }
  });
  return {ok:results.every(x => x.ok), results, remaining_daily_quota:MailApp.getRemainingDailyQuota()};
}

function sendNow_(messages) {
  const list = normalizeMessages_(messages);
  const results = [];
  let remaining = MailApp.getRemainingDailyQuota();

  list.forEach(m => {
    if (remaining <= 0) {
      results.push({index:m.index, ok:false, status:'failed', error:'Google Apps Script 今日寄送額度已用完，請改用排程或隔日再寄。'});
      return;
    }
    try {
      // 先建立草稿再送出，可取得 Gmail message ID，且失敗時較容易追蹤。
      const draft = GmailApp.createDraft(m.to, m.subject, m.body, mailOptions_(m));
      const draftId = draft.getId();
      const sent = draft.send();
      remaining = Math.max(0, remaining - 1);
      results.push({index:m.index, ok:true, status:'sent', draft_id:draftId, message_id:sent.getId()});
    } catch (err) {
      results.push({index:m.index, ok:false, status:'failed', error:String(err && err.message ? err.message : err)});
    }
  });

  return {ok:results.every(x => x.ok), results, remaining_daily_quota:MailApp.getRemainingDailyQuota()};
}

function scheduleDrafts_(messages, scheduledFor) {
  const when = new Date(String(scheduledFor || ''));
  if (!scheduledFor || isNaN(when.getTime())) {
    return {ok:false, error:'排程時間格式不正確。'};
  }
  if (when.getTime() <= Date.now() + 15000) {
    return {ok:false, error:'排程時間必須晚於目前時間至少 15 秒。'};
  }

  const list = normalizeMessages_(messages);
  const props = PropertiesService.getScriptProperties();
  const results = [];

  list.forEach(m => {
    try {
      const draft = GmailApp.createDraft(m.to, m.subject, m.body, mailOptions_(m));
      const scheduleId = Utilities.getUuid();
      const job = {
        schedule_id:scheduleId,
        draft_id:draft.getId(),
        scheduled_for:when.toISOString(),
        status:'scheduled',
        created_at:new Date().toISOString(),
        to:m.to,
        subject:m.subject
      };
      props.setProperty(JOB_PREFIX + scheduleId, JSON.stringify(job));
      results.push({
        index:m.index, ok:true, status:'scheduled',
        draft_id:job.draft_id, schedule_id:scheduleId, scheduled_for:job.scheduled_for
      });
    } catch (err) {
      results.push({index:m.index, ok:false, status:'failed', error:String(err && err.message ? err.message : err)});
    }
  });

  scheduleNextTrigger_();
  return {ok:results.every(x => x.ok), results, remaining_daily_quota:MailApp.getRemainingDailyQuota()};
}

function cancelScheduled_(ids, deleteDrafts) {
  const props = PropertiesService.getScriptProperties();
  const results = [];
  (Array.isArray(ids) ? ids : []).forEach(id => {
    const key = JOB_PREFIX + String(id);
    const raw = props.getProperty(key);
    if (!raw) {
      results.push({schedule_id:id, ok:false, error:'找不到排程'});
      return;
    }
    try {
      const job = JSON.parse(raw);
      if (job.status === 'sent') {
        results.push({schedule_id:id, ok:false, error:'此排程已寄出'});
        return;
      }
      let existingDraft = null;
      if (job.draft_id) {
        try {
          existingDraft = GmailApp.getDraft(job.draft_id);
        } catch (_) {
          results.push({schedule_id:id, ok:false, error:'Gmail 草稿已不存在，可能已被手動寄出或刪除，請重新整理排程狀態。'});
          return;
        }
      }
      if (deleteDrafts && existingDraft) existingDraft.deleteDraft();
      job.status = 'cancelled';
      job.cancelled_at = new Date().toISOString();
      props.setProperty(key, JSON.stringify(job));
      results.push({schedule_id:id, ok:true, status:'cancelled', draft_kept:!deleteDrafts});
    } catch (err) {
      results.push({schedule_id:id, ok:false, error:String(err && err.message ? err.message : err)});
    }
  });
  scheduleNextTrigger_();
  return {ok:results.every(x => x.ok), results};
}

function listScheduled_() {
  const jobs = getJobs_()
    .sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 500);
  return {
    ok:true,
    jobs,
    remaining_daily_quota:MailApp.getRemainingDailyQuota(),
    timezone:Session.getScriptTimeZone()
  };
}

function getJobs_() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const jobs = [];
  Object.keys(props).forEach(k => {
    if (!k.startsWith(JOB_PREFIX)) return;
    try { jobs.push(JSON.parse(props[k])); } catch (_) {}
  });
  return jobs;
}

function processScheduledMail() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;

  try {
    // 避免同一 handler 殘留多個觸發器。
    deleteScheduleTriggers_();

    const props = PropertiesService.getScriptProperties();
    const now = Date.now();
    let remaining = MailApp.getRemainingDailyQuota();

    const jobs = getJobs_()
      .filter(j => j.status === 'scheduled')
      .sort((a,b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime());

    for (const job of jobs) {
      const due = new Date(job.scheduled_for).getTime();
      if (due > now) break;
      if (remaining <= 0) break;

      const key = JOB_PREFIX + job.schedule_id;
      try {
        const draft = GmailApp.getDraft(job.draft_id);
        const msg = draft.send();
        job.status = 'sent';
        job.sent_at = new Date().toISOString();
        job.message_id = msg.getId();
        remaining = Math.max(0, remaining - 1);
      } catch (err) {
        job.status = 'failed';
        job.failed_at = new Date().toISOString();
        job.error = String(err && err.message ? err.message : err);
      }
      props.setProperty(key, JSON.stringify(job));
    }

    cleanupOldJobs_();
    scheduleNextTrigger_();
  } finally {
    lock.releaseLock();
  }
}

function scheduleNextTrigger_() {
  deleteScheduleTriggers_();

  const jobs = getJobs_()
    .filter(j => j.status === 'scheduled')
    .sort((a,b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime());

  if (!jobs.length) return;

  const now = Date.now();
  let next = new Date(jobs[0].scheduled_for);
  if (next.getTime() <= now) {
    // 如果因 Gmail 每日額度不足而尚未寄出，一小時後再檢查。
    next = new Date(now + 60 * 60 * 1000);
  }
  ScriptApp.newTrigger(HANDLER).timeBased().at(next).create();
}

function deleteScheduleTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === HANDLER) {
      try { ScriptApp.deleteTrigger(t); } catch (_) {}
    }
  });
}

function cleanupOldJobs_() {
  const props = PropertiesService.getScriptProperties();
  const limit = Date.now() - 30 * 24 * 60 * 60 * 1000;
  getJobs_().forEach(job => {
    if (!['sent','cancelled','failed'].includes(job.status)) return;
    const ts = new Date(job.sent_at || job.cancelled_at || job.failed_at || job.created_at || 0).getTime();
    if (ts && ts < limit) props.deleteProperty(JOB_PREFIX + job.schedule_id);
  });
}
