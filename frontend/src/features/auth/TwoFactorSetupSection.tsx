import React, { useState, useEffect } from "react";
import { fetchApi } from "../../lib/api";
import { toast } from "react-hot-toast";
import {
  ShieldCheck,
  ShieldAlert,
  QrCode,
  Key,
  Copy,
  Check,
  Download,
  Lock,
  RefreshCw,
  Trash2,
} from "lucide-react";

interface StatusResponse {
  is_enabled: boolean;
  backup_codes_remaining: number;
}

interface SetupData {
  secret: string;
  otpauth_url: string;
  backup_codes: string[];
  is_enabled: boolean;
}

export function TwoFactorSetupSection() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  // Modal states for Disabling and Regenerating
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const res = await fetchApi("/auth/2fa/status/");
      setStatus(res);
    } catch (err) {
      toast.error("Failed to load 2FA status.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, []);

  const handleStartSetup = async () => {
    try {
      setIsSettingUp(true);
      const res = await fetchApi("/auth/2fa/setup/", { method: "POST" });
      setSetupData(res);
      setVerificationCode("");
    } catch (err: any) {
      toast.error(err.message || "Failed to start 2FA setup.");
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || verificationCode.length < 6) {
      toast.error("Please enter a valid 6-digit TOTP code.");
      return;
    }

    try {
      setIsVerifying(true);
      await fetchApi("/auth/2fa/verify-setup/", {
        method: "POST",
        body: JSON.stringify({ code: verificationCode }),
      });
      toast.success("2FA enabled successfully! 🛡️");
      setSetupData(null);
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Invalid 2FA verification code. Try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalLoading(true);
      await fetchApi("/auth/2fa/disable/", {
        method: "POST",
        body: JSON.stringify({ password: confirmPassword }),
      });
      toast.success("2FA has been disabled.");
      setShowDisableModal(false);
      setConfirmPassword("");
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Incorrect password. Failed to disable 2FA.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalLoading(true);
      const res = await fetchApi("/auth/2fa/generate-backup-codes/", {
        method: "POST",
        body: JSON.stringify({ password: confirmPassword }),
      });
      setNewBackupCodes(res.backup_codes);
      toast.success("New recovery backup codes generated!");
      setConfirmPassword("");
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Incorrect password. Failed to regenerate backup codes.");
    } finally {
      setModalLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: "secret" | "backup") => {
    void navigator.clipboard.writeText(text);
    if (type === "secret") {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedBackup(true);
      setTimeout(() => setCopiedBackup(false), 2000);
    }
    toast.success("Copied to clipboard!");
  };

  const downloadBackupCodes = (codes: string[]) => {
    const content = `ATELIER 2FA RECOVERY BACKUP CODES\n${new Date().toISOString()}\n\nKeep these codes in a safe place. Each code can be used once.\n\n` + codes.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "atelier-2fa-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-6 rounded-2xl border-4 border-black bg-white dark:bg-[#121218] dark:border-[#3a3a45] shadow-card flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-black dark:text-white" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-4 border-black bg-white p-8 shadow-card dark:bg-[#121218] dark:border-[#3a3a45]">
      <div className="flex items-center justify-between border-b-2 border-dashed border-gray-200 dark:border-gray-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl border-2 border-black ${status?.is_enabled ? "bg-emerald-400 text-black" : "bg-amber-300 text-black"}`}>
            {status?.is_enabled ? <ShieldCheck className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight text-black dark:text-white flex items-center gap-2">
              Two-Factor Authentication (2FA)
            </h3>
            <p className="text-sm font-medium text-muted">
              Secure your account with an authenticator app (Google Authenticator, Authy, Bitwarden).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status?.is_enabled ? (
            <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 border-2 border-emerald-500">
              Enabled ✅
            </span>
          ) : (
            <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-amber-100 text-amber-800 border-2 border-amber-500">
              Disabled ⚠️
            </span>
          )}
        </div>
      </div>

      {/* CASE 1: 2FA IS NOT ENABLED & NO SETUP IN PROGRESS */}
      {!status?.is_enabled && !setupData && (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-800">
          <div>
            <h4 className="text-base font-bold text-black dark:text-white mb-1">
              Enhance Account Security
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xl">
              Requiring a 6-digit code from an authenticator app protects your maintainer and contributor privileges against password leaks and phishing.
            </p>
          </div>
          <button
            onClick={handleStartSetup}
            disabled={isSettingUp}
            className="px-6 py-3 font-black uppercase tracking-wider bg-black text-white dark:bg-white dark:text-black rounded-xl border-2 border-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-all flex items-center gap-2 shadow-sm shrink-0"
          >
            {isSettingUp ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
            Enable 2FA Now
          </button>
        </div>
      )}

      {/* CASE 2: SETUP IN PROGRESS */}
      {!status?.is_enabled && setupData && (
        <div className="space-y-6 bg-blue-50/50 dark:bg-blue-950/20 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-black uppercase tracking-tight text-black dark:text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-600" />
              Set Up Authenticator App
            </h4>
            <button
              onClick={() => setSetupData(null)}
              className="text-xs font-bold text-gray-500 hover:text-black dark:hover:text-white underline"
            >
              Cancel Setup
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Step 1: Scan QR or copy key */}
            <div className="space-y-4 bg-white dark:bg-[#1a1a24] p-5 rounded-xl border-2 border-gray-200 dark:border-gray-800">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 bg-black text-white dark:bg-white dark:text-black rounded">
                Step 1: Link Authenticator
              </span>

              {/* QR Code display */}
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg border border-gray-300">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(setupData.otpauth_url)}`}
                  alt="2FA QR Code"
                  className="w-44 h-44 object-contain"
                />
                <p className="mt-2 text-xs font-medium text-gray-500">Scan with Authenticator app</p>
              </div>

              {/* Secret Key Text */}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                  Manual Setup Secret Key
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 text-sm font-mono font-bold text-black dark:text-white rounded border border-gray-300 dark:border-gray-700 tracking-widest break-all">
                    {setupData.secret}
                  </code>
                  <button
                    onClick={() => copyToClipboard(setupData.secret, "secret")}
                    className="p-2 border-2 border-black rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-white"
                  >
                    {copiedSecret ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Save Backup Codes & Confirm */}
            <div className="space-y-4 bg-white dark:bg-[#1a1a24] p-5 rounded-xl border-2 border-gray-200 dark:border-gray-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 bg-black text-white dark:bg-white dark:text-black rounded">
                    Step 2: Save Recovery Codes
                  </span>
                  <button
                    onClick={() => downloadBackupCodes(setupData.backup_codes)}
                    className="text-xs font-bold flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" /> Download (.txt)
                  </button>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mb-2">
                  ⚠️ Save these 10 backup codes in a password manager. You can use them if you lose access to your authenticator.
                </p>

                <div className="grid grid-cols-2 gap-1.5 p-3 bg-gray-100 dark:bg-gray-800/80 rounded-lg border border-gray-300 dark:border-gray-700 max-h-36 overflow-y-auto">
                  {setupData.backup_codes.map((code, index) => (
                    <span key={index} className="text-xs font-mono font-bold text-gray-800 dark:text-gray-200">
                      {code}
                    </span>
                  ))}
                </div>
              </div>

              {/* Step 3: Enter Verification Code */}
              <form onSubmit={handleVerifySetup} className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-white">
                  Step 3: Enter 6-Digit Code to Confirm
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-4 py-2 text-center text-lg tracking-widest font-mono font-bold border-2 border-black rounded-xl bg-white text-black dark:bg-black dark:text-white dark:border-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={isVerifying || verificationCode.length !== 6}
                    className="px-5 py-2.5 bg-emerald-500 text-black font-black uppercase text-sm rounded-xl border-2 border-black hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {isVerifying ? "Verifying..." : "Enable 2FA"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CASE 3: 2FA IS ENABLED */}
      {status?.is_enabled && (
        <div className="space-y-6">
          <div className="p-6 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-base font-bold text-black dark:text-white">
                  Your Account is Protected with 2FA
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {status.backup_codes_remaining} single-use recovery backup codes remaining.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => {
                  setNewBackupCodes(null);
                  setConfirmPassword("");
                  setShowRegenerateModal(true);
                }}
                className="flex-1 md:flex-initial px-4 py-2 bg-white text-black dark:bg-gray-800 dark:text-white border-2 border-black rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                New Backup Codes
              </button>
              <button
                onClick={() => {
                  setConfirmPassword("");
                  setShowDisableModal(true);
                }}
                className="flex-1 md:flex-initial px-4 py-2 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-2 border-red-500 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-red-100 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Disable 2FA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISABLE MODAL */}
      {showDisableModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181820] border-4 border-black rounded-2xl p-6 max-w-md w-full shadow-card space-y-4">
            <h3 className="text-lg font-black uppercase text-black dark:text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-600" /> Confirm Disable 2FA
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Please enter your current account password to disable two-factor authentication.
            </p>
            <form onSubmit={handleDisable2FA} className="space-y-4">
              <input
                type="password"
                placeholder="Enter account password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 font-bold border-2 border-black rounded-xl bg-white dark:bg-black dark:text-white"
                required
              />
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisableModal(false)}
                  className="px-4 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading || !confirmPassword}
                  className="px-5 py-2 bg-red-600 text-white font-black text-xs uppercase rounded-xl border-2 border-black hover:bg-red-700 disabled:opacity-50"
                >
                  {modalLoading ? "Disabling..." : "Confirm & Disable"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGENERATE BACKUP CODES MODAL */}
      {showRegenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181820] border-4 border-black rounded-2xl p-6 max-w-md w-full shadow-card space-y-4">
            <h3 className="text-lg font-black uppercase text-black dark:text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" /> Generate New Backup Codes
            </h3>
            {!newBackupCodes ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Generating new backup codes will invalidate any remaining existing backup codes. Enter your password to proceed.
                </p>
                <form onSubmit={handleRegenerateBackupCodes} className="space-y-4">
                  <input
                    type="password"
                    placeholder="Enter account password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 font-bold border-2 border-black rounded-xl bg-white dark:bg-black dark:text-white"
                    required
                  />
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowRegenerateModal(false)}
                      className="px-4 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={modalLoading || !confirmPassword}
                      className="px-5 py-2 bg-black text-white dark:bg-white dark:text-black font-black text-xs uppercase rounded-xl border-2 border-black hover:bg-gray-800 disabled:opacity-50"
                    >
                      {modalLoading ? "Generating..." : "Generate Codes"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">
                  ⚠️ Save these 10 new recovery backup codes immediately!
                </p>
                <div className="grid grid-cols-2 gap-1.5 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 font-mono text-xs font-bold">
                  {newBackupCodes.map((code, i) => (
                    <span key={i}>{code}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => downloadBackupCodes(newBackupCodes)}
                    className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" /> Download (.txt)
                  </button>
                  <button
                    onClick={() => setShowRegenerateModal(false)}
                    className="px-5 py-2 bg-black text-white dark:bg-white dark:text-black font-black text-xs uppercase rounded-xl border-2 border-black"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
