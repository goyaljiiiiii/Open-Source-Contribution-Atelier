import React, { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';

export function SettingsPage() {
  const [prefs, setPrefs] = useState<Record<string, any>>({
    email: true,
    in_app: true,
    websocket: true,
    receive_weekly_digest: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/notifications/prefs/')
      .then(data => { setPrefs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggle = async (key: string) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    await fetchApi('/notifications/prefs/', {
      method: 'PUT',
      body: JSON.stringify(updated)
    });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="settings-page p-6 max-w-xl mx-auto bg-white dark:bg-[#111] rounded-2xl border border-black/10 dark:border-white/10 shadow-sm">
      <h2 className="text-xl font-black text-black dark:text-white mb-4 flex items-center gap-2">
        🔔 Notification Preferences
      </h2>
      <div className="settings-group flex flex-col gap-3">
        <label className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
          <input type="checkbox" checked={Boolean(prefs.email)} onChange={() => toggle('email')} className="w-4 h-4 rounded text-indigo-600" />
          📧 Email Notifications
        </label>
        <label className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(prefs.receive_weekly_digest ?? prefs.weekly_digest ?? true)}
            onChange={() => toggle('receive_weekly_digest')}
            className="w-4 h-4 rounded text-indigo-600"
          />
          📊 Weekly Learning Progress Digest Email
        </label>
        <label className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
          <input type="checkbox" checked={Boolean(prefs.in_app)} onChange={() => toggle('in_app')} className="w-4 h-4 rounded text-indigo-600" />
          📱 In-App Alerts
        </label>
        <label className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
          <input type="checkbox" checked={Boolean(prefs.websocket)} onChange={() => toggle('websocket')} className="w-4 h-4 rounded text-indigo-600" />
          🔄 WebSocket Real-time Updates
        </label>
      </div>

      <div className="mt-8 pt-6 border-t border-black/10 dark:border-white/10">
        <h2 className="text-xl font-black text-black dark:text-white mb-4 flex items-center gap-2">
          🌐 Language & Localization
        </h2>
        <p className="text-xs text-muted dark:text-[#9b8f80] mb-4">
          Select your preferred interface language across the application.
        </p>
        <div className="flex items-center gap-3">
          <LanguageSwitcher buttonClassName="px-3 py-2" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Choose from 9 supported languages (cached and persisted)
          </span>
        </div>
      </div>
    </div>
  );
}