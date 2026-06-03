'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Settings,
  QrCode,
  CreditCard,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Send,
  HelpCircle,
  FileText,
  Trash2,
  Activity,
} from 'lucide-react';

interface SettingsData {
  chatbotSettings: {
    gymId: string;
  } | null;
  paymentSettings: {
    upiId: string | null;
    upiName: string | null;
    razorpayKeyId: string | null;
    razorpayKeySecret: string | null;
    isRazorpayEnabled: boolean;
  } | null;
}

export default function SettingsPage() {
  const { gymSlug } = useParams() as { gymSlug: string };
  const [upiId, setUpiId] = useState('');
  const [upiName, setUpiName] = useState('');
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [isRazorpayEnabled, setIsRazorpayEnabled] = useState(false);

  // WhatsApp connection states
  const [isConnected, setIsConnected] = useState(false);
  const [waPhoneNumber, setWaPhoneNumber] = useState('');
  const [waPhoneNumberId, setWaPhoneNumberId] = useState('');
  const [waWabaId, setWaWabaId] = useState('');
  const [waBusinessId, setWaBusinessId] = useState('');
  const [waAnalytics, setWaAnalytics] = useState({ sent: 0, delivered: 0, read: 0, failed: 0, total: 0 });
  const [waMessages, setWaMessages] = useState<any[]>([]);
  const [waTemplates, setWaTemplates] = useState<any[]>([]);

  // Onboarding/Coexistence check states
  const [checkPhoneId, setCheckPhoneId] = useState('');
  const [checkToken, setCheckToken] = useState('');
  const [coexResult, setCoexResult] = useState<{
    eligible: boolean;
    status: string;
    qualityRating: string;
    details: string;
  } | null>(null);
  const [checkingCoex, setCheckingCoex] = useState(false);

  // Manual configuration inputs
  const [inputWabaId, setInputWabaId] = useState('');
  const [inputPhoneId, setInputPhoneId] = useState('');
  const [inputBusId, setInputBusId] = useState('');
  const [inputToken, setInputToken] = useState('');

  // Interactive controls
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isWaLoading, setIsWaLoading] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [error, setError] = useState('');

  // Simulator test inputs
  const [simPhone, setSimPhone] = useState('');
  const [simMessage, setSimMessage] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simSuccess, setSimSuccess] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/chatbot`);
      if (res.ok) {
        const data: SettingsData = await res.json();
        setUpiId(data.paymentSettings?.upiId || '');
        setUpiName(data.paymentSettings?.upiName || '');
        setRazorpayKeyId(data.paymentSettings?.razorpayKeyId || '');
        setRazorpayKeySecret(data.paymentSettings?.razorpayKeySecret || '');
        setIsRazorpayEnabled(data.paymentSettings?.isRazorpayEnabled || false);
      }

      // Fetch WhatsApp WABA configuration and analytics
      const waRes = await fetch(`/api/dashboard/${gymSlug}/whatsapp/status`);
      if (waRes.ok) {
        const waData = await waRes.json();
        setIsConnected(waData.connected || false);
        setWaPhoneNumber(waData.phoneNumber || '');
        setWaPhoneNumberId(waData.phoneNumberId || '');
        setWaWabaId(waData.wabaId || '');
        setWaBusinessId(waData.businessId || '');
        setWaAnalytics(waData.analytics || { sent: 0, delivered: 0, read: 0, failed: 0, total: 0 });
        setWaMessages(waData.recentMessages || []);
        setWaTemplates(waData.templates || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [gymSlug]);

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setError('');

    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upiId,
          upiName,
          razorpayKeyId,
          razorpayKeySecret,
          isRazorpayEnabled,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        await fetchSettings();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save settings.');
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  // Coexistence eligibility verification
  const handleCheckCoexistence = async () => {
    if (!checkPhoneId) {
      alert('Please enter a Phone Number ID to check.');
      return;
    }
    setCheckingCoex(true);
    setCoexResult(null);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/verify-eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumberId: checkPhoneId,
          accessToken: checkToken || undefined,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setCoexResult(result);
        
        // Auto-fill form fields if checking passes
        if (result.eligible) {
          setInputPhoneId(checkPhoneId);
          if (checkToken) setInputToken(checkToken);
        }
      } else {
        alert('Eligibility check API failed.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingCoex(false);
    }
  };

  // Connect WABA credentials manually
  const handleConnectWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputWabaId || !inputPhoneId || !inputBusId || !inputToken) {
      alert('All credentials are required to establish connection.');
      return;
    }
    setIsWaLoading(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wabaId: inputWabaId,
          phoneNumberId: inputPhoneId,
          businessId: inputBusId,
          accessToken: inputToken,
        }),
      });
      if (res.ok) {
        await fetchSettings();
      } else {
        const data = await res.json();
        alert(data.error || 'Connection failed.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsWaLoading(false);
    }
  };

  // Trigger simulated Embedded Signup Flow popup
  const handleSimulateEmbeddedSignup = async () => {
    setIsWaLoading(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/connect/simulate-success`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchSettings();
      } else {
        alert('Simulated embedded signup failed.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsWaLoading(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!confirm('Warning: Disconnecting WABA will stop all automated messages (expiry notifications, receipts, welcomes) and disable the chatbot service. Continue?')) {
      return;
    }
    setIsWaLoading(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/disconnect`, {
        method: 'POST',
      });
      if (res.ok) {
        setIsConnected(false);
        setCoexResult(null);
        await fetchSettings();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsWaLoading(false);
    }
  };

  // Synchronize Templates with WABA
  const handleSyncTemplates = async () => {
    setIsWaLoading(true);
    setSyncSuccess(false);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/sync-templates`, {
        method: 'POST',
      });
      if (res.ok) {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 3000);
        await fetchSettings();
      } else {
        alert('Failed to sync templates.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsWaLoading(false);
    }
  };

  // Simulate incoming customer message to test chatbot responses
  const handleSimulateInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simPhone || !simMessage) return;
    setSimulating(true);
    setSimSuccess(false);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: simPhone,
          message: simMessage,
        }),
      });
      if (res.ok) {
        setSimSuccess(true);
        setSimMessage('');
        setTimeout(() => setSimSuccess(false), 3000);
        await fetchSettings(); // refresh message logs list
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Integrations Setup</h2>
        <p className="text-xs text-zinc-500 mt-1">Connect your WhatsApp Business account and set up active payment channels.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* WhatsApp Management Column */}
        <div className="space-y-8">
          {/* Main Connection Status Card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md space-y-6">
            <h3 className="text-sm font-bold tracking-tight text-white uppercase tracking-wider flex items-center gap-2">
              <QrCode className="h-4 w-4 text-cyan-400" /> WABA Platform Connection
            </h3>

            {isConnected ? (
              // CONNECTED VIEW
              <div className="space-y-6">
                {/* Connection details banner */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider bg-emerald-950/50 px-2.5 py-1 rounded-md border border-emerald-900">
                      ● Active Connection
                    </span>
                    <span className="text-xs font-bold text-zinc-300">+{waPhoneNumber}</span>
                  </div>
                  <div className="divide-y divide-zinc-900 text-[11px] text-zinc-400">
                    <div className="py-2 flex justify-between">
                      <span>WABA ID:</span>
                      <span className="font-mono text-zinc-200">{waWabaId}</span>
                    </div>
                    <div className="py-2 flex justify-between">
                      <span>Phone Number ID:</span>
                      <span className="font-mono text-zinc-200">{waPhoneNumberId}</span>
                    </div>
                    <div className="py-2 flex justify-between">
                      <span>Business Account ID:</span>
                      <span className="font-mono text-zinc-200">{waBusinessId}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed pt-1">
                    System is actively listening to messages on this number. Staff can continue sending/receiving messages normally on the WhatsApp Business mobile app under Meta's supported Coexistence model.
                  </p>
                </div>

                {/* Analytics Block */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">WABA Dispatch Analytics</h4>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-3 text-center">
                      <span className="block text-[9px] font-bold text-zinc-500 uppercase">Sent</span>
                      <span className="text-sm font-black text-white">{waAnalytics.sent}</span>
                    </div>
                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-3 text-center">
                      <span className="block text-[9px] font-bold text-zinc-500 uppercase">Delivered</span>
                      <span className="text-sm font-black text-cyan-400">{waAnalytics.delivered}</span>
                    </div>
                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-3 text-center">
                      <span className="block text-[9px] font-bold text-zinc-500 uppercase">Read</span>
                      <span className="text-sm font-black text-emerald-400">{waAnalytics.read}</span>
                    </div>
                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-3 text-center">
                      <span className="block text-[9px] font-bold text-zinc-500 uppercase">Failed</span>
                      <span className="text-sm font-black text-rose-400">{waAnalytics.failed}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSyncTemplates}
                    disabled={isWaLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isWaLoading ? 'animate-spin' : ''}`} /> Sync Templates
                  </button>
                  <button
                    onClick={handleDisconnectWhatsApp}
                    disabled={isWaLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-rose-900 bg-rose-950/20 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-950/40"
                  >
                    Disconnect Account
                  </button>
                </div>
                {syncSuccess && (
                  <div className="text-center text-[10px] font-semibold text-emerald-400">
                    ✓ Templates successfully synchronized from Meta WABA!
                  </div>
                )}
              </div>
            ) : (
              // DISCONNECTED VIEW: ONBOARDING FLOWS
              <div className="space-y-6 text-xs">
                {/* Option 1: Embedded Signup Popup (Recommended) */}
                <div className="space-y-3">
                  <span className="block font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-900 pb-2">
                    Method 1: Meta Embedded Signup (Official)
                  </span>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Directly link your business number using Meta's official Embedded Signup. No technical details needed.
                  </p>
                  <button
                    onClick={handleSimulateEmbeddedSignup}
                    disabled={isWaLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3 font-bold text-white hover:bg-cyan-500 shadow-lg shadow-cyan-600/20 disabled:opacity-40"
                  >
                    {isWaLoading ? 'Launching Setup Dialog...' : 'Connect WhatsApp via Meta Signup'}
                  </button>
                </div>

                {/* Coexistence eligibility scanner */}
                <div className="space-y-4 border-t border-zinc-900 pt-5">
                  <span className="block font-bold text-zinc-400 uppercase tracking-widest">
                    Step 1: Check Coexistence Eligibility
                  </span>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Ensure your existing WhatsApp Business mobile app and WABA can operate concurrently before saving configuration.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block font-semibold text-zinc-500 uppercase tracking-wider">Phone Number ID</label>
                        <input
                          type="text"
                          placeholder="e.g. 102938475610293"
                          value={checkPhoneId}
                          onChange={(e) => setCheckPhoneId(e.target.value)}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-700 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-zinc-500 uppercase tracking-wider">System Token (Optional)</label>
                        <input
                          type="password"
                          placeholder="••••••••••••"
                          value={checkToken}
                          onChange={(e) => setCheckToken(e.target.value)}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-700 focus:outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCheckCoexistence}
                      disabled={checkingCoex}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 font-bold text-zinc-300 hover:bg-zinc-800"
                    >
                      {checkingCoex ? 'Verifying Eligibility...' : 'Scan Coexistence Eligibility'}
                    </button>
                  </div>

                  {coexResult && (
                    <div className={`rounded-xl border p-4 space-y-2 ${
                      coexResult.eligible 
                        ? 'border-emerald-500/20 bg-emerald-500/5 text-zinc-300' 
                        : 'border-amber-500/20 bg-amber-500/5 text-zinc-300'
                    }`}>
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                          {coexResult.eligible ? (
                            <>🟢 Eligible for Coexistence</>
                          ) : (
                            <>⚠️ Ineligible / Compatibility Warning</>
                          )}
                        </span>
                        <span className={`text-[10px] rounded px-1.5 py-0.5 border ${
                          coexResult.qualityRating === 'GREEN' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20' : 'border-rose-500/30 text-rose-400 bg-rose-950/20'
                        }`}>
                          Rating: {coexResult.qualityRating}
                        </span>
                      </div>
                      <p className="text-[10px] leading-relaxed text-zinc-400">{coexResult.details}</p>
                      
                      {!coexResult.eligible && (
                        <div className="flex items-start gap-1.5 text-[9px] text-amber-400 font-semibold bg-amber-950/20 p-2 rounded-lg border border-amber-900/30 mt-1">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>
                            Fallback Active: You can still force register the number, but it will de-register your phone's WhatsApp Business app unless you upgrade the app version to 2.24.17+.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Method 2: Manual Credentials input */}
                <form onSubmit={handleConnectWhatsApp} className="space-y-4 border-t border-zinc-900 pt-5">
                  <span className="block font-bold text-zinc-400 uppercase tracking-widest">
                    Method 2: Manual Developer/BSP Configuration
                  </span>
                  
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block font-semibold text-zinc-500 uppercase tracking-wider">WABA ID</label>
                      <input
                        type="text"
                        placeholder="WABA Account ID"
                        value={inputWabaId}
                        onChange={(e) => setInputWabaId(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-700 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-zinc-500 uppercase tracking-wider">Phone ID</label>
                      <input
                        type="text"
                        placeholder="Phone Number ID"
                        value={inputPhoneId}
                        onChange={(e) => setInputPhoneId(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-700 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block font-semibold text-zinc-500 uppercase tracking-wider">Business ID</label>
                      <input
                        type="text"
                        placeholder="Meta Business ID"
                        value={inputBusId}
                        onChange={(e) => setInputBusId(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-700 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-zinc-500 uppercase tracking-wider">Long-Lived Access Token</label>
                      <input
                        type="password"
                        placeholder="EAABw..."
                        value={inputToken}
                        onChange={(e) => setInputToken(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isWaLoading}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 py-2.5 font-bold text-white hover:bg-zinc-800"
                  >
                    Save Credentials & Pair Number
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Synced Templates Status Table */}
          {isConnected && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md space-y-4">
              <h3 className="text-sm font-bold tracking-tight text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-400" /> Template Synchronization
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs divide-y divide-zinc-900">
                  <thead>
                    <tr className="text-zinc-500 font-bold uppercase tracking-wider">
                      <th className="py-2.5">Template Name</th>
                      <th>Category</th>
                      <th>Language</th>
                      <th className="text-right">Approval Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 text-zinc-300">
                    {waTemplates.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-zinc-500">No synchronized templates. Click Sync Templates.</td>
                      </tr>
                    ) : (
                      waTemplates.map((t) => (
                        <tr key={t.id} className="py-2">
                          <td className="py-2.5 font-bold text-white font-mono">{t.templateName}</td>
                          <td className="text-zinc-400">{t.category}</td>
                          <td className="text-zinc-500">{t.language}</td>
                          <td className="text-right">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase ${
                              t.status === 'APPROVED' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                              t.status === 'PENDING' ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' :
                              'bg-zinc-850 border-zinc-800 text-zinc-500'
                            }`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Payments, Logs, and Chatbot Simulator Column */}
        <div className="space-y-8">
          {/* Payment Settings Card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md space-y-6">
            <h3 className="text-sm font-bold tracking-tight text-white uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-cyan-400" /> Payment Credentials
            </h3>

            {saveSuccess && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-400">
                ✓ Credentials updated and saved successfully!
              </div>
            )}

            {isLoading ? (
              <div className="flex h-48 items-center justify-center text-xs text-zinc-500">Loading configurations...</div>
            ) : (
              <form onSubmit={handleSavePaymentSettings} className="space-y-6 text-xs">
                {/* Mode 1: Manual UPI setup */}
                <div className="space-y-4">
                  <span className="block font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-900 pb-2">
                    Mode 1: Manual UPI Configuration
                  </span>
                  
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">UPI ID</label>
                      <input
                        type="text"
                        placeholder="e.g. gymowner@okaxis"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        required
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Business Display Name</label>
                      <input
                        type="text"
                        placeholder="e.g. FitLife Fitness"
                        value={upiName}
                        onChange={(e) => setUpiName(e.target.value)}
                        required
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Mode 2: Razorpay credentials */}
                <div className="space-y-4 border-t border-zinc-900 pt-6">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-400 uppercase tracking-widest">
                      Mode 2: Razorpay Gateway
                    </span>
                    <input
                      type="checkbox"
                      checked={isRazorpayEnabled}
                      onChange={(e) => setIsRazorpayEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-850 bg-zinc-900 text-cyan-600 focus:ring-cyan-500 accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  {isRazorpayEnabled && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Razorpay Key ID</label>
                        <input
                          type="text"
                          placeholder="rzp_test_key1234"
                          value={razorpayKeyId}
                          onChange={(e) => setRazorpayKeyId(e.target.value)}
                          required={isRazorpayEnabled}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Razorpay Key Secret</label>
                        <input
                          type="password"
                          placeholder="••••••••••••"
                          value={razorpayKeySecret}
                          onChange={(e) => setRazorpayKeySecret(e.target.value)}
                          required={isRazorpayEnabled}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-cyan-600 py-3 font-bold text-white transition-all hover:bg-cyan-500 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" /> {isSaving ? 'Saving Configurations...' : 'Save Payment Credentials'}
                </button>
              </form>
            )}
          </div>

          {/* Chatbot Simulator Form - Connected Status Only */}
          {isConnected && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md space-y-4">
              <h3 className="text-sm font-bold tracking-tight text-white uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" /> Chatbot Webhook Test Simulator
              </h3>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Simulate receiving an incoming WhatsApp message to test RAG contexts, chatbot menus, or automated actions without needing to send real messages.
              </p>
              {simSuccess && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-[10px] font-semibold text-emerald-400">
                  ✓ Inbound message successfully processed by webhook. Bot reply queued!
                </div>
              )}
              <form onSubmit={handleSimulateInbound} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-semibold text-zinc-500 uppercase tracking-wider">Member Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 919988776655"
                      value={simPhone}
                      onChange={(e) => setSimPhone(e.target.value)}
                      required
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-zinc-500 uppercase tracking-wider">Message Text</label>
                    <input
                      type="text"
                      placeholder="e.g. 1 (view membership)"
                      value={simMessage}
                      onChange={(e) => setSimMessage(e.target.value)}
                      required
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-700 focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={simulating}
                  className="w-full flex items-center justify-center gap-1 rounded-xl bg-cyan-600 py-2.5 font-bold text-white hover:bg-cyan-500"
                >
                  <Send className="h-3 w-3" /> {simulating ? 'Injecting Webhook...' : 'Simulate Incoming Message'}
                </button>
              </form>
            </div>
          )}

          {/* Recent Message Logs block */}
          {isConnected && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md space-y-4">
              <h3 className="text-sm font-bold tracking-tight text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-400" /> Recent Message Logs
              </h3>
              <div className="divide-y divide-zinc-900 max-h-72 overflow-y-auto space-y-3 pr-2">
                {waMessages.length === 0 ? (
                  <div className="text-center py-6 text-xs text-zinc-500">No WhatsApp messages dispatched yet.</div>
                ) : (
                  waMessages.map((msg: any) => (
                    <div key={msg.id} className="pt-3 flex justify-between items-start gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="block font-bold text-zinc-300">
                          {msg.direction === 'INBOUND' ? `← From +${msg.senderPhone}` : 
                           msg.direction === 'ECHO' ? `→ Staff Coex Reply (To +${msg.recipientPhone})` :
                           `→ To +${msg.recipientPhone}`}
                        </span>
                        <p className="text-[11px] text-zinc-400 italic bg-zinc-950/40 p-2 rounded-lg border border-zinc-900/60 leading-relaxed font-mono">
                          {msg.text}
                        </p>
                        <span className="block text-[9px] text-zinc-600">
                          {new Date(msg.createdAt).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                          msg.status === 'READ' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                          msg.status === 'DELIVERED' ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' :
                          msg.status === 'SENT' ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' :
                          'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}>
                          {msg.status}
                        </span>
                        {msg.errorMessage && (
                          <span className="block text-[8px] text-rose-400 mt-1 truncate max-w-xs">{msg.errorMessage}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
