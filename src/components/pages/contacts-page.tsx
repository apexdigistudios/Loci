"use client";

import React from "react";
import { Contact as ContactIcon, Plus, Loader2, Trash2 } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  phone: string;
}

interface ContactsPageProps {
  contacts: Contact[];
  contactsSupported: boolean;
  addingContact: boolean;
  manualName: string;
  setManualName: (v: string) => void;
  manualPhone: string;
  setManualPhone: (v: string) => void;
  handlePickDeviceContact: () => void;
  handleAddManualContact: (e: React.FormEvent) => void;
  handleDeleteContact: (id: string) => void;
}

export function ContactsPage({
  contacts,
  contactsSupported,
  addingContact,
  manualName,
  setManualName,
  manualPhone,
  setManualPhone,
  handlePickDeviceContact,
  handleAddManualContact,
  handleDeleteContact,
}: ContactsPageProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-black text-black dark:text-white">Guardian Contacts 🛡️</h2>
        <p className="text-[11px] text-zinc-400">People notified when your safety timer expires.</p>
      </div>

      {contactsSupported && (
        <button
          onClick={handlePickDeviceContact}
          disabled={addingContact}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black py-3.5 rounded-2xl text-xs flex items-center justify-center space-x-2 active:scale-[0.97] transition-all shadow-sm"
        >
          <ContactIcon className="w-4 h-4" />
          <span>Import From Phone Contacts 📲</span>
        </button>
      )}

      <form
        onSubmit={handleAddManualContact}
        className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-4 rounded-[26px] space-y-3"
      >
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Add Guardian Manually</p>
        <div className="space-y-2">
          <input
            type="text"
            required
            placeholder="Name (e.g. Ama)"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            className="w-full bg-zinc-100/70 dark:bg-black/40 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl px-3.5 py-2.5 text-xs text-black dark:text-white focus:outline-none focus:border-yellow-400"
          />
          <input
            type="tel"
            required
            placeholder="Phone Number (+233...)"
            value={manualPhone}
            onChange={(e) => setManualPhone(e.target.value)}
            className="w-full bg-zinc-100/70 dark:bg-black/40 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl px-3.5 py-2.5 text-xs text-black dark:text-white focus:outline-none focus:border-yellow-400"
          />
        </div>
        <button
          type="submit"
          disabled={addingContact}
          className="w-full bg-black dark:bg-white text-white dark:text-black font-extrabold py-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 active:scale-[0.97] transition-all"
        >
          {addingContact ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Save Guardian</span>
            </>
          )}
        </button>
      </form>

      <div className="space-y-2">
        {contacts.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
            No contacts added yet.
          </div>
        ) : (
          contacts.map((c) => (
            <div
              key={c.id}
              className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 px-4 py-3 rounded-2xl flex items-center justify-between shadow-sm"
            >
              <div>
                <p className="text-xs font-extrabold text-black dark:text-white">{c.name}</p>
                <p className="text-[11px] font-mono text-zinc-400">{c.phone}</p>
              </div>
              <button
                onClick={() => handleDeleteContact(c.id)}
                className="p-2 text-zinc-400 hover:text-red-500 transition-colors active:scale-90"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}