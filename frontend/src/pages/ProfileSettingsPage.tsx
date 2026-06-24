import React, { useState } from "react";
import { ProfileSettingsForm } from "../features/auth/ProfileSettingsForm";
import { DeleteAccountModal } from "../components/ui/DeleteAccountModal";

export function ProfileSettingsPage() {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* HEADER SECTION */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-black uppercase tracking-tight">
            Profile Settings
          </h1>
          <p className="mt-2 text-lg font-medium text-muted">
            Update your account information and preferences
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border-4 border-black bg-[#E8F0FE] p-8 shadow-card">
          <h2 className="mb-6 text-2xl font-bold uppercase tracking-tight text-black flex items-center gap-3">
            <span className="text-3xl">⚙️</span> Settings
          </h2>
          <ProfileSettingsForm />
        </div>

        {/* Additional information card or future settings */}
        <div className="rounded-2xl border-4 border-black bg-[#FFF0E5] p-8 shadow-card flex flex-col justify-center items-center text-center">
          <div className="text-6xl mb-6">🔒</div>
          <h2 className="text-2xl font-bold uppercase tracking-tight text-black mb-4">
            Security & Privacy
          </h2>
          <p className="text-lg font-medium text-black/80 max-w-md mb-8">
            Your data is stored securely. Passwords are cryptographically hashed
            and never stored in plain text.
          </p>
          
          <div className="w-full pt-6 border-t-4 border-black/10 flex flex-col items-center">
            <h3 className="font-bold text-red-600 uppercase mb-4">Danger Zone</h3>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-6 py-3 bg-red-50 text-red-600 border-2 border-red-200 rounded-xl font-bold hover:bg-red-100 hover:border-red-300 transition-colors"
            >
              Delete Account Permanently
            </button>
          </div>
        </div>
      </div>
      
      <DeleteAccountModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
      />
    </div>
  );
}
