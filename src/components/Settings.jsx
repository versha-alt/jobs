import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api.js';
import { toast } from '../toast.js';
import { EASE, Icon, Spinner } from './ui.jsx';

function TelegramConnection({ user }) {
  const isAdmin = user?.role === 'admin';
  const [info, setInfo] = useState(null);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let alive = true;
    api.settings
      .getTelegram()
      .then((d) => {
        if (!alive) return;
        setInfo(d);
        setChatId(d.chatId ?? '');
      })
      .catch((err) => toast.error(err.message));
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  if (!isAdmin) return null;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);
    try {
      const d = await api.settings.saveTelegram({
        botToken: botToken.trim() || undefined,
        chatId,
      });
      setInfo(d);
      setBotToken('');
      setShowToken(false);
      toast.success('Telegram settings updated — applies to the next delivery');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const runTest = async (sendTest) => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.settings.testTelegram({ sendTest });
      setTestResult({
        ok: true,
        msg: sendTest ? `Test message delivered via @${r.bot}` : `Connected as @${r.bot}`,
      });
    } catch (err) {
      setTestResult({ ok: false, msg: err.message });
    } finally {
      setTesting(false);
    }
  };

  const src = (key) => (info?.sources?.[key] === 'database' ? 'saved setting' : '.env fallback');

  return (
    <>
      <div className="section-head apify-head">
        <h2>Telegram connection</h2>
        <span className="muted">admin only</span>
      </div>
      <motion.div layout className="card">
        <form onSubmit={save} className="form">
          <label className="field">
            <span className="field-label">TELEGRAM_BOT_TOKEN</span>
            <div className="auth-input-wrap">
              <input
                type={showToken ? 'text' : 'password'}
                value={botToken}
                placeholder={info?.botTokenSet ? `${info.botTokenMask} — leave blank to keep` : '123456789:AaBbCc…'}
                onChange={(e) => setBotToken(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowToken(!showToken)}
                aria-label={showToken ? 'Hide token' : 'Show token'}
                title={showToken ? 'Hide token' : 'Show token'}
              >
                <Icon name={showToken ? 'eyeOff' : 'eye'} />
              </button>
            </div>
            {info?.botTokenSet && <span className="hint">Current token: {info.botTokenMask} ({src('telegramBotToken')})</span>}
          </label>

          <label className="field">
            <span className="field-label">TELEGRAM_CHAT_ID</span>
            <input
              className="text-input"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="8279366380 (or -100… for groups)"
              autoComplete="off"
            />
            <span className="hint">Where run summaries are delivered — {src('telegramChatId')}</span>
          </label>

          <div className="form-actions tg-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <Spinner />}
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={testing}
              onClick={() => runTest(false)}
              title="Check the bot credentials against Telegram"
            >
              {testing ? <Spinner /> : <Icon name="zap" size={14} />}
              Test connection
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={testing}
              onClick={() => runTest(true)}
              title="Send a test message to the configured chat"
            >
              Send test message
            </button>
          </div>

          {testResult && (
            <div className={testResult.ok ? 'tg-test-ok' : 'auth-error'}>{testResult.msg}</div>
          )}

          <p className="hint">
            Values saved here override the .env file and apply to the next delivery — no restart
            needed. Clearing a field falls back to the .env value.
          </p>
        </form>
      </motion.div>
    </>
  );
}

function ApifyConnection({ user }) {
  const isAdmin = user?.role === 'admin';
  const [info, setInfo] = useState(null);
  const [token, setToken] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [upwork, setUpwork] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let alive = true;
    api.settings
      .getApify()
      .then((d) => {
        if (!alive) return;
        setInfo(d);
        setLinkedin(d.linkedinActorId);
        setUpwork(d.upworkActorId);
      })
      .catch((err) => toast.error(err.message));
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  if (!isAdmin) return null;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const d = await api.settings.saveApify({
        token: token.trim() || undefined,
        linkedinActorId: linkedin,
        upworkActorId: upwork,
      });
      setInfo(d);
      setToken('');
      setShowToken(false);
      toast.success('Apify connection updated — future runs use it immediately');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const src = (key) => (info?.sources?.[key] === 'database' ? 'saved setting' : '.env fallback');

  return (
    <>
      <div className="section-head apify-head">
        <h2>Apify connection</h2>
        <span className="muted">admin only</span>
      </div>
      <motion.div layout className="card">
      <form onSubmit={save} className="form">
        <label className="field">
          <span className="field-label">APIFY_TOKEN</span>
          <div className="auth-input-wrap">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              placeholder={info?.tokenSet ? `${info.tokenMask} — leave blank to keep` : 'apify_api_…'}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              className="auth-eye"
              onClick={() => setShowToken(!showToken)}
              aria-label={showToken ? 'Hide token' : 'Show token'}
              title={showToken ? 'Hide token' : 'Show token'}
            >
              <Icon name={showToken ? 'eyeOff' : 'eye'} />
            </button>
          </div>
          {info?.tokenSet && <span className="hint">Current token: {info.tokenMask} ({src('token')})</span>}
        </label>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">LinkedIn jobs actor</span>
            <input
              className="text-input"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="curious_coder/linkedin-jobs-scraper"
              autoComplete="off"
            />
            <span className="hint">owner/actor-name — {src('linkedinActorId')}</span>
          </label>
          <label className="field">
            <span className="field-label">Upwork jobs actor</span>
            <input
              className="text-input"
              value={upwork}
              onChange={(e) => setUpwork(e.target.value)}
              placeholder="neatrat/upwork-job-scraper"
              autoComplete="off"
            />
            <span className="hint">owner/actor-name — {src('upworkActorId')}</span>
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving && <Spinner />}
            {saving ? 'Saving…' : 'Save connection'}
          </button>
        </div>
        <p className="hint">
          Values saved here override the .env file immediately — no restart needed. Clearing an
          actor field falls back to the .env value.
        </p>
      </form>
      </motion.div>
    </>
  );
}

export default function Settings({ countries, reload, user }) {
  const [name, setName] = useState('');

  const add = async (e) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    try {
      await api.countries.add(v);
      setName('');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (c) => {
    try {
      await api.countries.remove(c.id);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <ApifyConnection user={user} />
      <TelegramConnection user={user} />

      <div className="section-head">
        <h2>Manage countries</h2>
        <span className="muted">{countries.length} available</span>
      </div>
      <motion.div layout className="card">
        <form className="country-add" onSubmit={add}>
          <input
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a country…"
          />
          <button type="submit" className="btn btn-primary btn-icon" aria-label="Add country">
            <Icon name="plus" />
          </button>
        </form>
        <div className="multi-select country-list">
          <AnimatePresence initial={false}>
            {countries.map((c) => (
              <motion.span
                key={c.id}
                layout
                className="chip"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15, ease: EASE }}
              >
                {c.name}
                <button
                  type="button"
                  className="chip-x"
                  onClick={() => remove(c)}
                  aria-label={`Remove ${c.name}`}
                >
                  <Icon name="x" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
        <p className="hint">
          The list is stored data, not hard-coded — every search screen reads from it. Removing a
          country only affects what is offered going forward; existing saved searches keep working.
        </p>
      </motion.div>
    </div>
  );
}
