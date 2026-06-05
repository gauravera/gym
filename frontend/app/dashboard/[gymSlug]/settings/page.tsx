"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone,
  RefreshCcw,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  FileText,
  Trash2,
  Lock,
  Layers,
  Activity,
  Award,
  Globe2,
  ChevronRight,
  TrendingUp,
  Sparkles,
} from "lucide-react";

type WhatsAppStatus = "not_configured" | "connected" | "error";
type SetupMethod = "embedded" | "manual";

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

export default function WhatsAppSetupPage() {
  const { gymSlug } = useParams() as { gymSlug: string };

  // Helper to extract nested Meta errors
  async function parseError(res: Response, defaultMessage: string): Promise<string> {
    try {
      const data = await res.json();
      const metaMessage = data.metaError?.error?.message || data.metaError?.message;
      if (metaMessage) {
        return `${data.error || defaultMessage} — ${metaMessage}`;
      }
      return data.error || defaultMessage;
    } catch {
      return defaultMessage;
    }
  }

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [status, setStatus] = useState<WhatsAppStatus>("not_configured");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupMethod, setSetupMethod] = useState<SetupMethod>("embedded");
  const [setupStep, setSetupStep] = useState<string | null>(null);

  const sessionRef = useRef<{
    whatsappBusinessId: string;
    whatsappPhoneNumberId: string;
  } | null>(null);

  const [config, setConfig] = useState<{
    connected?: boolean;
    phoneNumber?: string;
    phoneNumberId?: string;
    wabaId?: string;
    businessId?: string;
    facebookAppId?: string | null;
    facebookConfigId?: string | null;
    whatsappVerificationStatus?: string;
    whatsappQualityRating?: string;
    whatsappMessagingTier?: string;
    whatsappVerifiedName?: string;
    whatsappDisplayPhoneNumber?: string;
    analytics?: {
      sent: number;
      delivered: number;
      read: number;
      failed: number;
      total: number;
    };
    recentMessages?: Array<{
      id: string;
      messageId: string;
      senderPhone: string;
      recipientPhone: string;
      text: string;
      direction: string;
      status: string;
      createdAt: string;
    }>;
    templates?: Array<{
      id: string;
      templateName: string;
      status: string;
      category: string;
      language: string;
    }>;
  }>({});

  const [form, setForm] = useState({
    wabaId: "",
    phoneNumberId: "",
    accessToken: "",
    businessId: "",
  });

  const [embeddedSession, setEmbeddedSession] = useState<{
    whatsappBusinessId: string;
    whatsappPhoneNumberId: string;
  } | null>(null);

  const [showCodeInput, setShowCodeInput] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  const [refreshing, setRefreshing] = useState(false);
  const [reverifying, setReverifying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [syncingTemplates, setSyncingTemplates] = useState(false);

  /* ================= LOAD STATUS ================= */

  async function loadStatus() {
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/status`);
      if (!res.ok) {
        throw new Error("Failed to load WhatsApp status");
      }
      const data = await res.json();
      setConfig(data);
      setStatus(data.connected ? "connected" : "not_configured");
    } catch (err: any) {
      console.error(err);
      setStatus("not_configured");
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, [gymSlug]);

  /* ================= FACEBOOK SDK ================= */

  useEffect(() => {
    if (!config.facebookAppId || window.FB) return;

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: config.facebookAppId,
        xfbml: false,
        version: "v20.0",
      });
    };

    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    document.body.appendChild(script);
  }, [config.facebookAppId]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) {
        return;
      }

      const payload =
        typeof event.data === "string"
          ? (() => {
              try {
                return JSON.parse(event.data);
              } catch {
                return null;
              }
            })()
          : event.data;

      if (!payload) return;

      if (payload.type === "WA_EMBEDDED_SIGNUP") {
        console.log("📩 WA_EMBEDDED_SIGNUP:", payload);

        if (payload.event === "FINISH" || payload.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
          setSetupStep("WhatsApp account received from Meta...");
          const newSession = {
            whatsappBusinessId: payload.data.waba_id,
            whatsappPhoneNumberId: payload.data.phone_number_id || "",
          };
          setEmbeddedSession(newSession);
          sessionRef.current = newSession;
        }

        if (payload.event === "ERROR") {
          console.error("❌ Embedded signup error:", payload.data);
          toast.error("Embedded signup error from Meta.");
        }

        if (payload.event === "CANCEL") {
          console.warn("⚠️ Embedded signup cancelled:", payload.data);
          toast.warning("Signup popup closed.");
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  /* ================= PREFILL FORM ON EDIT ================= */
  useEffect(() => {
    if (!config.wabaId || !config.phoneNumberId) return;

    setForm((prev) => ({
      ...prev,
      wabaId: config.wabaId!,
      phoneNumberId: config.phoneNumberId!,
      accessToken: "",
      businessId: config.businessId || "",
    }));
  }, [config.wabaId, config.phoneNumberId, config.businessId]);

  /* ================= SUBMIT ================= */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSetupStep("Saving credentials...");

    try {
      const payload = {
        ...form,
        businessId: form.businessId || form.wabaId,
      };
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorMsg = await parseError(res, "Setup connection failed.");
        throw new Error(errorMsg);
      }

      toast.success("WhatsApp configuration updated successfully");
      setIsEditing(false);
      await loadStatus();
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Setup failed");
      toast.error(err.message || "Setup failed");
    } finally {
      setSaving(false);
      setSetupStep(null);
    }
  }

  /* ================= DISCONNECT ================= */

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect WhatsApp Business? This will disable all active alerts.")) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/disconnect`, {
        method: "POST",
      });
      if (!res.ok) {
        const errorMsg = await parseError(res, "Failed to disconnect.");
        throw new Error(errorMsg);
      }
      toast.success("WhatsApp disconnected successfully");
      setIsEditing(false);
      await loadStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect.");
    } finally {
      setSaving(false);
    }
  }

  /* ================= REFRESH ================= */

  async function handleRefreshStatus() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/refresh-status`, {
        method: "POST",
      });
      if (!res.ok) {
        const errorMsg = await parseError(res, "Failed to sync status");
        throw new Error(errorMsg);
      }
      await loadStatus();
      toast.success("WhatsApp health status synced with Meta");
    } catch (err: any) {
      toast.error(err.message || "Failed to refresh status");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleReverify() {
    setReverifying(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/reverify`, {
        method: "POST",
      });
      if (!res.ok) {
        const errorMsg = await parseError(res, "Re-verification failed");
        throw new Error(errorMsg);
      }
      const data = await res.json();

      if (data.whatsappVerificationStatus === "VERIFIED") {
        toast.success("WhatsApp connection verified successfully!");
        setShowCodeInput(false);
        await loadStatus();
      } else {
        console.log("☎️ Registration retry requested. Initiating Meta request_code...");
        const regRes = await fetch(`/api/dashboard/${gymSlug}/whatsapp/register`, {
          method: "POST",
        });
        if (!regRes.ok) {
          const regErrorMsg = await parseError(regRes, "Failed to request verification code");
          throw new Error(regErrorMsg);
        }
        setShowCodeInput(true);
        toast.info("A verification code has been sent to your WhatsApp number.");
      }
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setReverifying(false);
    }
  }

  async function handleVerifyCode() {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verificationCode }),
      });
      if (!res.ok) {
        const errorMsg = await parseError(res, "Verification code check failed.");
        throw new Error(errorMsg);
      }
      setShowCodeInput(false);
      setVerificationCode("");
      toast.success("Phone number verified and registered successfully");
      await loadStatus();
    } catch (err: any) {
      toast.error(err.message || "Verification failed. Please check the code.");
    } finally {
      setVerifying(false);
    }
  }

  /* ================= SYNC TEMPLATES ================= */

  async function handleSyncTemplates() {
    setSyncingTemplates(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/sync-templates`, {
        method: "POST",
      });
      if (!res.ok) {
        const errorMsg = await parseError(res, "Template sync failed.");
        throw new Error(errorMsg);
      }
      await loadStatus();
      toast.success("Templates synchronized successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to sync templates.");
    } finally {
      setSyncingTemplates(false);
    }
  }

  /* ================= EMBEDDED SIGNUP ================= */

  function handleEmbeddedSignup() {
    if (!window.FB) {
      toast.error("Facebook SDK not loaded. App ID might be missing.");
      return;
    }

    setSaving(true);
    setError(null);
    setSetupStep("Opening Meta signup...");
    setEmbeddedSession(null);
    sessionRef.current = null;

    window.FB.login(
      (response: any) => {
        if (!response.authResponse) {
          setSaving(false);
          setSetupStep(null);
          toast.error("Signup cancelled");
          return;
        }

        const code = response.authResponse.code;
        setSetupStep("Receiving WhatsApp account details...");

        const waitForSession = async () => {
          for (let i = 0; i < 20; i++) {
            if (sessionRef.current) return sessionRef.current;
            await new Promise((r) => setTimeout(r, 500));
          }
          return null;
        };

        (async () => {
          const session = await waitForSession();

          if (!session) {
            setSaving(false);
            setSetupStep(null);
            setError("Failed to receive WhatsApp account details from Meta");
            toast.error("Failed to receive WhatsApp account details from Meta");
            return;
          }

          try {
            setSetupStep("Activating phone number...");
            const res = await fetch(`/api/dashboard/${gymSlug}/whatsapp/embedded-setup`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                code,
                wabaId: session.whatsappBusinessId,
                phoneNumberId: session.whatsappPhoneNumberId,
                businessId: session.whatsappBusinessId,
              }),
            });

            if (!res.ok) {
              const errorMsg = await parseError(res, "Embedded setup failed");
              throw new Error(errorMsg);
            }

            toast.success("WhatsApp connected successfully");
            setIsEditing(false);
            await loadStatus();
          } catch (err: any) {
            setError(err.message || "Embedded signup failed");
            toast.error(err.message || "Embedded signup failed");
          } finally {
            setSaving(false);
            setSetupStep(null);
          }
        })();
      },
      {
        config_id: config.facebookConfigId || "",
        response_type: "code",
        override_default_response_type: true,
        extras: {
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      }
    );
  }

  /* ================= GUARDS ================= */

  if (pageLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-xs text-zinc-500">
        <RefreshCcw className="h-5 w-5 animate-spin text-cyan-400" />
        <span>Loading integrations state...</span>
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            WhatsApp Integrations
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Configure automated membership alerts, renewal reminders, and RAG chatbot workflows.
          </p>
        </div>
        <div>
          {status === "connected" && (
            <span className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Connected to Cloud API
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 border border-rose-500/20">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              Connection Error
            </span>
          )}
          {status === "not_configured" && (
            <span className="flex items-center gap-2 rounded-xl bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-400 border border-zinc-700">
              Not Configured
            </span>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ================= CONNECTED/ERROR VIEW ================= */}
        {status === "connected" && !isEditing && config.phoneNumberId && (
          <motion.div
            key="connected-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Alerts */}
            {config.whatsappVerificationStatus !== "VERIFIED" && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      Verification Incomplete
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
                      Your number is connected to the dashboard but has not finished SMS/Voice validation with Meta. You must register the line to send messages.
                    </p>
                  </div>
                  {!showCodeInput ? (
                    <button
                      onClick={handleReverify}
                      disabled={reverifying}
                      className="rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-bold text-white transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {reverifying ? (
                        <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                      ) : null}
                      {reverifying ? "Sending Pin..." : "Verify Phone Number"}
                    </button>
                  ) : null}
                </div>

                {showCodeInput && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 border-t border-zinc-800/80 pt-4"
                  >
                    <div className="max-w-md space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                        Enter 6-Digit Verification Code
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          value={verificationCode}
                          onChange={(e) =>
                            setVerificationCode(e.target.value.replace(/\D/g, ""))
                          }
                          placeholder="123456"
                          className="w-40 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-white placeholder-zinc-700 font-mono tracking-widest focus:outline-none focus:border-cyan-500"
                        />
                        <button
                          onClick={handleVerifyCode}
                          disabled={verifying}
                          className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                          {verifying ? (
                            <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                          ) : null}
                          Verify & Register
                        </button>
                        <button
                          onClick={() => setShowCodeInput(false)}
                          className="rounded-xl border border-zinc-850 px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-900"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* Health & Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Verification Status */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 backdrop-blur-md flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                  Meta Verification
                </span>
                <span className="text-sm font-bold text-white flex items-center gap-2 mt-1">
                  {config.whatsappVerificationStatus === "VERIFIED" ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Verified
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      {config.whatsappVerificationStatus || "Unverified"}
                    </>
                  )}
                </span>
              </div>

              {/* Quality Rating */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 backdrop-blur-md flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                  Quality Rating
                </span>
                <span className="text-sm font-bold text-white flex items-center gap-2 mt-1">
                  {config.whatsappQualityRating === "GREEN" ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      High (Green)
                    </>
                  ) : config.whatsappQualityRating === "YELLOW" ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Medium (Yellow)
                    </>
                  ) : config.whatsappQualityRating === "RED" ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
                      Low (Red)
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-zinc-600" />
                      Unknown
                    </>
                  )}
                </span>
              </div>

              {/* Messaging Tier */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 backdrop-blur-md flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                  Messaging Limit Tier
                </span>
                <span className="text-sm font-bold text-white mt-1">
                  {config.whatsappMessagingTier
                    ? config.whatsappMessagingTier.replace(/_/g, " ")
                    : "Unknown Tier"}
                </span>
              </div>
            </div>

            {/* Connection Details */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Connection Settings
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleRefreshStatus}
                    disabled={refreshing}
                    className="rounded-xl border border-zinc-850 hover:bg-zinc-900 px-3.5 py-2 text-xs font-bold text-zinc-300 transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <RefreshCcw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    Sync Status
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="rounded-xl border border-zinc-850 hover:bg-zinc-900 px-3.5 py-2 text-xs font-bold text-cyan-400 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={saving}
                    className="rounded-xl border border-zinc-850 hover:bg-rose-950/30 hover:border-rose-900/50 hover:text-rose-400 px-3.5 py-2 text-xs font-bold text-rose-500 transition-all flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-4">
                  <div>
                    <span className="text-zinc-500 font-semibold block mb-1">
                      Business Verified Name
                    </span>
                    <span className="font-bold text-white text-sm">
                      {config.whatsappVerifiedName || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 font-semibold block mb-1">
                      Display Phone Number
                    </span>
                    <span className="font-mono font-bold text-cyan-400 text-sm">
                      {config.whatsappDisplayPhoneNumber || config.phoneNumber || "—"}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="text-zinc-500 font-semibold block mb-1">
                      WhatsApp Phone ID
                    </span>
                    <span className="font-mono text-white text-sm">
                      {config.phoneNumberId}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 font-semibold block mb-1">
                      WhatsApp WABA ID
                    </span>
                    <span className="font-mono text-white text-sm">
                      {config.wabaId || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Analytics Dashboard */}
            {config.analytics && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Message Delivery Stats
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="border border-zinc-900 bg-zinc-950 p-4 rounded-xl text-center">
                    <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider block">Sent</span>
                    <span className="text-xl font-black text-white mt-1 block">{config.analytics.sent}</span>
                  </div>
                  <div className="border border-zinc-900 bg-zinc-950 p-4 rounded-xl text-center">
                    <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider block">Delivered</span>
                    <span className="text-xl font-black text-emerald-400 mt-1 block">{config.analytics.delivered}</span>
                  </div>
                  <div className="border border-zinc-900 bg-zinc-950 p-4 rounded-xl text-center">
                    <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider block">Read</span>
                    <span className="text-xl font-black text-cyan-400 mt-1 block">{config.analytics.read}</span>
                  </div>
                  <div className="border border-zinc-900 bg-zinc-950 p-4 rounded-xl text-center">
                    <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider block">Failed</span>
                    <span className="text-xl font-black text-rose-400 mt-1 block">{config.analytics.failed}</span>
                  </div>
                  <div className="border border-zinc-900 bg-zinc-950 p-4 rounded-xl text-center col-span-2 sm:col-span-1">
                    <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider block">Total Traffic</span>
                    <span className="text-xl font-black text-white mt-1 block">{config.analytics.total}</span>
                  </div>
                </div>
              </div>
            )}


            {/* Message Activity Log */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-cyan-400" />
                Recent Message Logs
              </h3>

              <div className="overflow-x-auto">
                {config.recentMessages && config.recentMessages.length > 0 ? (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Sender/Recipient</th>
                        <th className="py-2.5 px-3">Direction</th>
                        <th className="py-2.5 px-3">Message</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/60">
                      {config.recentMessages.map((m) => (
                        <tr key={m.id} className="hover:bg-zinc-900/10 transition-all">
                          <td className="py-3 px-3 text-zinc-400 font-mono">
                            {new Date(m.createdAt).toLocaleDateString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3 px-3 text-zinc-300 font-mono">
                            {m.direction === "INBOUND" ? m.senderPhone : m.recipientPhone}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${
                                m.direction === "INBOUND"
                                  ? "bg-cyan-500/10 text-cyan-400"
                                  : m.direction === "ECHO"
                                  ? "bg-purple-500/10 text-purple-400"
                                  : "bg-amber-500/10 text-amber-400"
                              }`}
                            >
                              {m.direction}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-zinc-300 truncate max-w-[200px]" title={m.text}>
                            {m.text}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`font-semibold ${
                                m.status === "READ"
                                  ? "text-cyan-400"
                                  : m.status === "DELIVERED"
                                  ? "text-emerald-400"
                                  : m.status === "FAILED"
                                  ? "text-rose-400"
                                  : "text-zinc-400"
                              }`}
                            >
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-zinc-600 italic py-4">No recent messaging records.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ================= SETUP / EDIT MODE VIEW ================= */}
        {(status !== "connected" || isEditing) && (
          <motion.div
            key="setup-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-8"
          >
            {/* Header info */}
            <div className="text-center max-w-xl mx-auto space-y-2">
              <h3 className="text-xl font-bold text-white">Choose Setup Method</h3>
              <p className="text-xs text-zinc-500">
                Configure your WhatsApp Business API connection. Access tokens are stored securely encrypted.
              </p>
            </div>

            {/* Selection Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Embedded Signup Card */}
              <button
                type="button"
                onClick={() => setSetupMethod("embedded")}
                className={`relative overflow-hidden flex flex-col p-6 rounded-2xl border text-left transition-all duration-200 ${
                  setupMethod === "embedded"
                    ? "border-cyan-500 bg-cyan-950/10 ring-2 ring-cyan-500/20"
                    : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between mb-4 w-full">
                  <div
                    className={`p-3 rounded-xl border ${
                      setupMethod === "embedded"
                        ? "bg-cyan-950 text-cyan-400 border-cyan-800"
                        : "bg-zinc-900 text-zinc-500 border-zinc-800"
                    }`}
                  >
                    <Smartphone className="w-5 h-5" />
                  </div>
                  {setupMethod === "embedded" && (
                    <span className="bg-cyan-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight">
                      Selected
                    </span>
                  )}
                </div>
                <h4 className="font-extrabold text-sm text-white mb-1">Embedded Signup</h4>
                <p className="text-xs text-zinc-500 leading-relaxed mb-4">
                  The recommended method. Log in directly using your Meta profile to sync the integration.
                </p>
                <div className="mt-auto flex items-center gap-1 text-[10px] font-bold text-cyan-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Fastest setup (Meta Popup)</span>
                </div>
              </button>

              {/* Manual Setup Card */}
              <button
                type="button"
                onClick={() => setSetupMethod("manual")}
                className={`relative overflow-hidden flex flex-col p-6 rounded-2xl border text-left transition-all duration-200 ${
                  setupMethod === "manual"
                    ? "border-cyan-500 bg-cyan-950/10 ring-2 ring-cyan-500/20"
                    : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between mb-4 w-full">
                  <div
                    className={`p-3 rounded-xl border ${
                      setupMethod === "manual"
                        ? "bg-cyan-950 text-cyan-400 border-cyan-800"
                        : "bg-zinc-900 text-zinc-500 border-zinc-800"
                    }`}
                  >
                    <Lock className="w-5 h-5" />
                  </div>
                  {setupMethod === "manual" && (
                    <span className="bg-cyan-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight">
                      Selected
                    </span>
                  )}
                </div>
                <h4 className="font-extrabold text-sm text-white mb-1">Manual Setup</h4>
                <p className="text-xs text-zinc-500 leading-relaxed mb-4">
                  Enter your credentials manually. Copy IDs and Permanent Access Tokens from Meta Developer Suite.
                </p>
                <div className="mt-auto flex items-center gap-1 text-[10px] font-bold text-zinc-400">
                  <Globe2 className="w-3.5 h-3.5" />
                  <span>Advanced control config</span>
                </div>
              </button>
            </div>

            {/* Method Containers */}
            <div className="max-w-2xl mx-auto">
              {setupMethod === "embedded" && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md space-y-6">
                  <div className="space-y-1 border-b border-zinc-900 pb-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-cyan-400" />
                      Configure via Meta popup
                    </h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Authenticate utilizing Facebook OAuth to sync Business account settings.
                    </p>
                  </div>

                  <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 space-y-2">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Benefits
                    </p>
                    <ul className="text-xs text-zinc-400 space-y-1.5 pl-1">
                      <li className="flex items-center gap-2">
                        <ChevronRight className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                        No manual token copies
                      </li>
                      <li className="flex items-center gap-2">
                        <ChevronRight className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                        Secure Facebook OAuth login flow
                      </li>
                      <li className="flex items-center gap-2">
                        <ChevronRight className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                        Automatic App Subscriptions set up
                      </li>
                    </ul>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-semibold text-rose-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {saving && setupStep && (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 text-xs flex items-center gap-3">
                      <RefreshCcw className="w-4 h-4 animate-spin text-cyan-400" />
                      <span className="text-zinc-300 font-medium animate-pulse">{setupStep}</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleEmbeddedSignup}
                      disabled={saving}
                      className="flex-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 py-3 text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <RefreshCcw className="w-4 h-4 animate-spin" />
                          <span>Integrating...</span>
                        </>
                      ) : (
                        <>
                          <span>🔗</span>
                          <span>Launch Meta Embedded Signup</span>
                        </>
                      )}
                    </button>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="rounded-xl border border-zinc-850 hover:bg-zinc-900 py-3 px-6 text-xs font-bold text-zinc-400 transition-all"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}

              {setupMethod === "manual" && (
                <form
                  onSubmit={handleSubmit}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md space-y-5"
                >
                  <div className="space-y-1 border-b border-zinc-900 pb-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-cyan-400" />
                      Manual Configuration Form
                    </h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Copy credentials from Meta Developer Manager and register them below.
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-semibold text-rose-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Business ID */}
                  <div>
                    <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
                      Meta Business Account ID (WABA ID)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 123456789012345"
                      value={form.wabaId}
                      onChange={(e) => setForm({ ...form, wabaId: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Phone Number ID */}
                  <div>
                    <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
                      Phone Number ID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 987654321098765"
                      value={form.phoneNumberId}
                      onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Meta Business ID */}
                  <div>
                    <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
                      Meta Business Portfolio ID (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 543210987654321"
                      value={form.businessId}
                      onChange={(e) => setForm({ ...form, businessId: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Access Token */}
                  <div>
                    <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
                      Permanent Access Token
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxx..."
                      value={form.accessToken}
                      onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 text-xs text-white placeholder-zinc-700 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {saving && setupStep && (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 text-xs flex items-center gap-3">
                      <RefreshCcw className="w-4 h-4 animate-spin text-cyan-400" />
                      <span className="text-zinc-300 font-medium animate-pulse">{setupStep}</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 py-3 text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {saving ? "Configuring..." : "Save Connection Details"}
                    </button>
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="rounded-xl border border-zinc-850 hover:bg-zinc-900 py-3 px-6 text-xs font-bold text-zinc-400 transition-all"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ToastContainer theme="dark" position="bottom-right" />
      <style>{`
        :root {
          --toastify-color-dark: #27272a !important; /* zinc-800 */
          --toastify-color-info: #06b6d4 !important; /* cyan-500 */
          --toastify-color-success: #10b981 !important; /* emerald-500 */
          --toastify-color-warning: #f59e0b !important; /* amber-500 */
          --toastify-color-error: #ef4444 !important; /* rose-500 */
          --toastify-font-family: inherit !important;
        }
        .Toastify__toast {
          border-radius: 16px !important;
          border: 1px solid #3f3f46 !important; /* zinc-700 */
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.2) !important;
        }
        .Toastify__toast--dark {
          background-color: #27272a !important; /* zinc-800 dark grey */
          color: #f4f4f5 !important; /* zinc-100 */
        }
        .Toastify__progress-bar--dark {
          background: linear-gradient(to right, #06b6d4, #8b5cf6) !important; /* gradient slider */
        }
      `}</style>
    </div>
  );
}
