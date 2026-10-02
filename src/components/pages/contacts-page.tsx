"use client";

import React, { useState, useRef } from "react";
import {
  Users,
  Radio,
  Plus,
  Trash2,
  Loader2,
  X,
  ChevronLeft,
  FolderPlus,
  Image as ImageIcon,
  Shield,
  UserCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SharedSessionsPage } from "./shared-sessions-page";

export interface Contact {
  id: string;
  name: string;
  phone: string;
  group_category?: string;
  isLociUser?: boolean;
  avatar_url?: string;
}

interface CustomGroup {
  key: string;
  label: string;
  desc: string;
  imageUrl?: string;
}

interface ContactsPageProps {
  userPhone: string;
  openSessionId?: string | null;
  onSessionOpened?: () => void;
  contacts: Contact[];
  addingContact: boolean;
  manualName: string;
  setManualName: (v: string) => void;
  manualPhone: string;
  setManualPhone: (v: string) => void;
  handleAddManualContact: (e: React.FormEvent, selectedGroup?: string) => void;
  handleDeleteContact: (id: string) => void;
  onContactAdded?: (contact: Contact) => void;
}

const DEFAULT_GROUPS = [
  {
    key: "Emergency Circle",
    label: "Emergency Circle",
    image: "/pages/emergency.png",
    accent: "bg-zinc-900 border-red-500/40 text-red-400",
    badgeBg: "bg-black/60 backdrop-blur-md text-red-300 border-red-500/40",
    desc: "First responders & primary emergency guardians",
    isDefault: true,
  },
  {
    key: "Family",
    label: "Family",
    image: "/pages/family.png",
    accent: "bg-zinc-900 border-yellow-400/40 text-yellow-400",
    badgeBg: "bg-black/60 backdrop-blur-md text-yellow-300 border-yellow-400/40",
    desc: "Parents, siblings & immediate family",
    isDefault: true,
  },
  {
    key: "Besties",
    label: "Besties",
    image: "/pages/besties.png",
    accent: "bg-zinc-900 border-zinc-700/60 text-zinc-200",
    badgeBg: "bg-black/60 backdrop-blur-md text-zinc-300 border-zinc-700",
    desc: "Close friends, roommates & ride partners",
    isDefault: true,
  },
];

export function ContactsPage({
  userPhone,
  openSessionId,
  onSessionOpened,
  contacts,
  addingContact,
  manualName,
  setManualName,
  manualPhone,
  setManualPhone,
  handleAddManualContact,
  handleDeleteContact,
  onContactAdded,
}: ContactsPageProps) {
  const [subTab, setSubTab] = useState<"contacts" | "shared">(
    () => (openSessionId ? "shared" : "contacts")
  );
  const [activeGroupView, setActiveGroupView] = useState<string | null>(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>("Emergency Circle");
  const [customGroupInput, setCustomGroupInput] = useState("");
  const [customGroupImage, setCustomGroupImage] = useState<string | null>(null);
  const [showCustomGroupField, setShowCustomGroupField] = useState(false);

  // Persistent Custom Groups State
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("loci_custom_groups");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse saved custom groups", e);
        }
      }
    }
    return [];
  });

  const [importing, setImporting] = useState(false);
  const groupImageInputRef = useRef<HTMLInputElement>(null);

  const handleAutoPickContacts = async () => {
    setImporting(true);

    if (typeof window !== "undefined" && "contacts" in navigator && "ContactsManager" in window) {
      try {
        const props = ["name", "tel"];
        const selectedContacts = await (navigator as any).contacts.select(props, { multiple: false });

        if (selectedContacts && selectedContacts.length > 0) {
          const picked = selectedContacts[0];
          const name = picked.name?.[0] || "Circle Member";
          const phone = picked.tel?.[0] || "";

          if (phone) {
            const { data, error } = await supabase
              .from("trusted_contacts")
              .insert({
                user_phone: userPhone,
                name: name,
                phone: phone,
                group_category: selectedGroup,
              })
              .select()
              .single();

            if (!error && data) {
              if (onContactAdded) onContactAdded(data);
              setImporting(false);
              setShowAddModal(false);
              return;
            }
          }
        }
      } catch (err) {
        console.error("Auto contact import failed:", err);
      }
    }
    setImporting(false);
  };

  const handleGroupImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomGroupImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateCustomGroup = () => {
    if (!customGroupInput.trim()) return;
    const gName = customGroupInput.trim();

    if (!customGroups.some((cg) => cg.key === gName)) {
      const newGroup: CustomGroup = {
        key: gName,
        label: gName,
        desc: "Custom guardian group",
        imageUrl: customGroupImage || undefined,
      };
      const updated = [...customGroups, newGroup];
      setCustomGroups(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("loci_custom_groups", JSON.stringify(updated));
      }
    }

    setSelectedGroup(gName);
    setCustomGroupInput("");
    setCustomGroupImage(null);
    setShowCustomGroupField(false);
  };

  const handleDeleteCustomGroup = (groupKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customGroups.filter((cg) => cg.key !== groupKey);
    setCustomGroups(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("loci_custom_groups", JSON.stringify(updated));
    }
    if (activeGroupView === groupKey) {
      setActiveGroupView(null);
    }
  };

  const submitManualWithGroup = (e: React.FormEvent) => {
    e.preventDefault();
    handleAddManualContact(e, selectedGroup);
    setShowAddModal(false);
  };

  const allGroups = [
    ...DEFAULT_GROUPS,
    ...customGroups.map((cg) => ({
      key: cg.key,
      label: cg.label,
      image: cg.imageUrl || "",
      accent: "bg-zinc-900 border-zinc-700/60 text-zinc-200",
      badgeBg: "bg-black/60 backdrop-blur-md text-zinc-300 border-zinc-700",
      desc: cg.desc,
      isDefault: false,
    })),
  ];

  const activeGroupData = allGroups.find((g) => g.key === activeGroupView);
  const groupContacts = contacts.filter(
    (c) => (c.group_category || "Emergency Circle") === activeGroupView
  );

  return (
    <div className="space-y-5">
      {/* Subtab Toggle Bar */}
      <div className="p-1 bg-zinc-200/60 dark:bg-zinc-900/80 rounded-full grid grid-cols-2 gap-1 border border-zinc-300/40 dark:border-zinc-800">
        <button
          onClick={() => {
            setSubTab("contacts");
            setActiveGroupView(null);
          }}
          className={`py-2 rounded-full text-xs font-black transition-all flex items-center justify-center space-x-1.5 ${
            subTab === "contacts"
              ? "bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm"
              : "text-zinc-400 hover:text-black dark:hover:text-white"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>My Circle</span>
        </button>

        <button
          onClick={() => setSubTab("shared")}
          className={`py-2 rounded-full text-xs font-black transition-all flex items-center justify-center space-x-1.5 relative ${
            subTab === "shared"
              ? "bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm"
              : "text-zinc-400 hover:text-black dark:hover:text-white"
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
          <span>Shared Sessions</span>
        </button>
      </div>

      {/* SUBVIEW 1: MY CIRCLE */}
      {subTab === "contacts" && (
        <>
          {activeGroupView ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setActiveGroupView(null)}
                  className="p-2.5 rounded-full bg-zinc-200/60 dark:bg-zinc-900/60 backdrop-blur-xl text-black dark:text-white active:scale-90 transition-all shadow-sm flex items-center space-x-1 pr-3.5 border border-zinc-300/40 dark:border-zinc-800"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  <span className="text-xs font-bold">Groups</span>
                </button>

                <div className="flex items-center space-x-2">
                  {!activeGroupData?.isDefault && (
                    <button
                      onClick={(e) => handleDeleteCustomGroup(activeGroupView, e)}
                      className="p-2.5 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-90 border border-red-500/30"
                      title="Delete Custom Group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setSelectedGroup(activeGroupView);
                      setShowAddModal(true);
                    }}
                    className="w-9 h-9 rounded-full bg-yellow-400 text-black flex items-center justify-center font-black active:scale-90 transition-all shadow-md shadow-yellow-400/20"
                  >
                    <Plus className="w-5 h-5 stroke-3" />
                  </button>
                </div>
              </div>

              {/* Group Header Banner */}
              <div className="bg-zinc-900 text-white p-5 rounded-[28px] border border-zinc-800 relative overflow-hidden flex flex-col justify-end min-h-36 shadow-lg">
                {activeGroupData?.image ? (
                  <img
                    src={activeGroupData.image}
                    alt={activeGroupData.label}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                    <Shield className="w-24 h-24 text-yellow-400" />
                  </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                <div className="relative z-10 space-y-0.5">
                  <span className="text-[10px] font-black uppercase text-yellow-400 tracking-wider">
                    Group Circle
                  </span>
                  <h3 className="text-xl font-extrabold text-white">{activeGroupView}</h3>
                  <p className="text-xs text-zinc-200">
                    {groupContacts.length} Linked Guardians in this circle
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {groupContacts.length === 0 ? (
                  <div className="text-center py-10 px-4 bg-white/60 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 rounded-[26px] space-y-2">
                    <UserCheck className="w-8 h-8 text-zinc-500 mx-auto" />
                    <p className="text-xs font-extrabold text-black dark:text-white">
                      No contacts in {activeGroupView} yet
                    </p>
                    <button
                      onClick={() => {
                        setSelectedGroup(activeGroupView);
                        setShowAddModal(true);
                      }}
                      className="inline-flex items-center space-x-1.5 bg-yellow-400 text-black px-4 py-2 rounded-full text-xs font-black shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Guardian to {activeGroupView}</span>
                    </button>
                  </div>
                ) : (
                  groupContacts.map((c) => (
                    <div
                      key={c.id}
                      className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/50 px-4 py-3.5 rounded-2xl flex items-center justify-between shadow-sm"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-900 text-yellow-400 font-black text-xs flex items-center justify-center uppercase border border-yellow-400/40">
                          {c.isLociUser && c.avatar_url ? (
                            <img src={c.avatar_url} alt={`${c.name}'s profile`} className="w-full h-full object-cover" />
                          ) : (
                            c.name.slice(0, 2)
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <p className="text-xs font-extrabold text-black dark:text-white">
                              {c.name}
                            </p>
                            {c.isLociUser && (
                              <span className="bg-yellow-400 text-black text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase">
                                Déloci Member
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-zinc-400">{c.phone}</p>
                        </div>
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
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-base font-black text-black dark:text-white">My Circle 🛡️️</h2>
                  <p className="text-[11px] text-zinc-400">
                    Organized guardian circles for instant safety dispatch.
                  </p>
                </div>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-11 h-11 rounded-full bg-yellow-400 text-black flex items-center justify-center active:scale-90 transition-all shadow-lg shadow-yellow-400/20 border-2 border-yellow-300"
                  title="Add Guardian or Group"
                >
                  <Plus className="w-6 h-6 stroke-3" />
                </button>
              </div>

              {/* Bento Grid */}
              <div className="grid grid-cols-2 gap-3">
                {allGroups.map((grp, idx) => {
                  const count = contacts.filter(
                    (c) => (c.group_category || "Emergency Circle") === grp.key
                  ).length;

                  const isWide = idx === 0;

                  return (
                    <div
                      key={grp.key}
                      onClick={() => setActiveGroupView(grp.key)}
                      className={`p-4 rounded-[26px] ${grp.accent} border relative overflow-hidden cursor-pointer active:scale-95 transition-all shadow-sm flex flex-col justify-between group ${
                        isWide ? "col-span-2 min-h-36" : "min-h-40"
                      }`}
                    >
                      {grp.image && (
                        <img
                          src={grp.image}
                          alt={grp.label}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                        />
                      )}
                      <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-black/10 pointer-events-none" />

                      <div className="relative z-10 flex items-center justify-between">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${grp.badgeBg}`}>
                          {count} Linked
                        </span>

                        {!grp.isDefault && (
                          <button
                            onClick={(e) => handleDeleteCustomGroup(grp.key, e)}
                            className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-zinc-300 hover:text-red-400 hover:bg-black/80 active:scale-90 transition-all border border-zinc-700/60"
                            title="Delete Custom Group"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="relative z-10 pt-4">
                        <h3 className="text-sm font-black text-white drop-shadow-md">{grp.label}</h3>
                        <p className="text-[10px] text-zinc-200 line-clamp-1 opacity-90 drop-shadow-md">
                          {grp.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Modal */}
          {showAddModal && (
            <div className="fixed inset-0 z-100 bg-black/80 backdrop-blur-md p-4 flex items-center justify-center animate-in fade-in">
              <div className="bg-zinc-900 text-white border border-zinc-800 rounded-4xl p-6 w-full max-w-sm space-y-5 relative shadow-2xl">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white active:scale-90 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold flex items-center space-x-1.5 text-white">
                    <Users className="w-4 h-4 text-yellow-400" />
                    <span>Add Guardian to Circle</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Select a group or create a new circle category.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                    Target Guardian Group
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {allGroups.map((g) => (
                      <button
                        key={g.key}
                        type="button"
                        onClick={() => setSelectedGroup(g.key)}
                        className={`p-2.5 rounded-xl text-xs font-black text-left border transition-all ${
                          selectedGroup === g.key
                            ? "bg-yellow-400 text-black border-yellow-400 shadow-sm"
                            : "bg-black/50 text-zinc-300 border-zinc-800 hover:border-zinc-700"
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setShowCustomGroupField(!showCustomGroupField)}
                      className="p-2.5 rounded-xl text-xs font-black text-left border border-dashed border-zinc-700 text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20 flex items-center space-x-1"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>+ Add Group</span>
                    </button>
                  </div>
                </div>

                {showCustomGroupField && (
                  <div className="p-3 bg-black/60 border border-zinc-800 rounded-2xl space-y-2.5 animate-in fade-in">
                    <input
                      type="file"
                      ref={groupImageInputRef}
                      accept="image/*"
                      onChange={handleGroupImageUpload}
                      className="hidden"
                    />

                    <input
                      type="text"
                      placeholder="New group name (e.g. Neighbors)"
                      value={customGroupInput}
                      onChange={(e) => setCustomGroupInput(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-yellow-400"
                    />

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => groupImageInputRef.current?.click()}
                        className="inline-flex items-center space-x-1.5 text-[11px] font-extrabold text-yellow-400 bg-yellow-400/10 px-3 py-1.5 rounded-lg border border-yellow-400/20 hover:bg-yellow-400/20 active:scale-95 transition-all"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>{customGroupImage ? "Change Image" : "Upload Card Image"}</span>
                      </button>

                      {customGroupImage && (
                        <span className="text-[10px] text-emerald-400 font-extrabold">
                          ✓ Image Attached
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleCreateCustomGroup}
                      className="w-full bg-yellow-400 text-black font-extrabold py-2 rounded-xl text-xs"
                    >
                      Create Group
                    </button>
                  </div>
                )}

                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={handleAutoPickContacts}
                    disabled={importing}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold py-3 rounded-2xl text-xs flex items-center justify-center space-x-2 active:scale-95 transition-all shadow-md shadow-yellow-400/20"
                  >
                    {importing ? (
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                    ) : (
                      <>
                        <Users className="w-4 h-4" />
                        <span>Import Phone Contact to {selectedGroup}</span>
                      </>
                    )}
                  </button>

                  <form onSubmit={submitManualWithGroup} className="space-y-2.5 pt-2">
                    <input
                      type="text"
                      required
                      placeholder="Guardian Name"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-yellow-400"
                    />
                    <input
                      type="tel"
                      required
                      placeholder="Phone (+233...)"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-yellow-400"
                    />
                    <button
                      type="submit"
                      disabled={addingContact}
                      className="w-full bg-white text-black font-black py-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 active:scale-95 transition-all"
                    >
                      {addingContact ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <span>Save to {selectedGroup}</span>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* SUBVIEW 2: SHARED SESSIONS FULL PAGE DELEGATE */}
      {subTab === "shared" && (
        <SharedSessionsPage
          userPhone={userPhone}
          contacts={contacts}
          openSessionId={openSessionId}
          onSessionOpened={onSessionOpened}
        />
      )}
    </div>
  );
}