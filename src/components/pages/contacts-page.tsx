"use client";

import React, { useState, useRef } from "react";
import {
  Users,
  Radio,
  Plus,
  Trash2,
  Loader2,
  ChevronLeft,
  FolderPlus,
  Image as ImageIcon,
  Shield,
  UserCheck,
  ArrowLeft,
  Sparkles,
  Phone,
  MessageSquare,
  FolderInput,
  UserPlus,
  X,
  UserMinus,
} from "lucide-react";
import { SharedSessionsPage } from "./shared-sessions-page";

interface DeviceContactPicker {
  select: (
    properties: Array<"name" | "tel">,
    options: { multiple: boolean }
  ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
}

export interface Contact {
  id: string;
  contact_user_id?: string;
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
  currentUserId: string | null;
  openSessionId?: string | null;
  onSessionOpened?: () => void;
  contacts: Contact[];
  addingContact: boolean;
  manualName: string;
  setManualName: (v: string) => void;
  manualPhone: string;
  setManualPhone: (v: string) => void;
  handleAddManualContact: (selectedGroup?: string, contact?: { name: string; phone: string }) => Promise<boolean>;
  handleDeleteContact: (id: string) => void;
  onNavigate?: (tab: "home" | "session" | "contacts" | "share" | "profile") => void;
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
  currentUserId,
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
}: ContactsPageProps) {
  const [subTab, setSubTab] = useState<"contacts" | "shared">(
    () => (openSessionId ? "shared" : "contacts")
  );
  
  const [circleView, setCircleView] = useState<"groups" | "contacts">("contacts");
  const [activeGroupView, setActiveGroupView] = useState<string | null>(null);

  const [pageView, setPageView] = useState<"main" | "add-contact" | "add-group" | "group-add-chooser" | "pick-from-direct">("main");
  const [contactStep, setContactStep] = useState<1 | 2>(1);

  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const [customGroupInput, setCustomGroupInput] = useState("");
  const [customGroupImage, setCustomGroupImage] = useState<string | null>(null);
  const [pendingContact, setPendingContact] = useState<{ name: string; phone: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [contextContact, setContextContact] = useState<Contact | null>(null);
  const [contextMenuAction, setContextMenuAction] = useState<"menu" | "select-group" | null>(null);

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

  const [importing, setImporting] = useState<boolean>(false);
  const groupImageInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const getUserTier = () => {
    if (typeof window === "undefined") return "free";
    return localStorage.getItem("deloci_user_tier") || "free";
  };

  const normalizePhone = (phone: string) => {
    const stripped = phone.replace(/[\s\-\(\)]/g, "");
    if (stripped.startsWith("+")) return `+${stripped.slice(1).replace(/\D/g, "")}`;
    const digits = stripped.replace(/\D/g, "");
    if (digits.startsWith("233")) return `+${digits}`;
    if (digits.startsWith("0")) return `+233${digits.slice(1)}`;
    return `+233${digits}`;
  };

  const formatPhonePreview = (phone: string) => phone.startsWith("+233") && phone.length === 13
    ? `+233 ${phone.slice(4, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`
    : phone;

  const handleAutoPickContacts = async () => {
    setImporting(true);

    if (typeof window !== "undefined" && "contacts" in navigator) {
      try {
        const props: Array<"name" | "tel"> = ["name", "tel"];
        const picker = (navigator as Navigator & { contacts: DeviceContactPicker }).contacts;
        const selectedContacts = await picker.select(props, { multiple: false });

        if (selectedContacts && selectedContacts.length > 0) {
          const picked = selectedContacts[0];
          const name = picked.name?.[0] || "Circle Member";
          const phone = picked.tel?.[0] || "";

          if (phone) {
            const normalized = normalizePhone(phone);
            setPendingContact({ name, phone: normalized });
            setContactStep(2);
          } else {
            showToast("Selected contact has no valid phone number.");
          }
        }
      } catch (err) {
        console.error("Auto contact import failed:", err);
        showToast("Failed to access device contacts.");
      }
    } else {
      showToast("Device contact picker is not supported on this browser.");
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
    const tier = getUserTier();
    if (tier === "free") {
      showToast("Free users cannot create new custom groups. Upgrade to Déloci Plus!");
      return;
    }

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

    setSelectedGroup(null);
    setCustomGroupInput("");
    setCustomGroupImage(null);
    setPageView("main");
    showToast(`Group "${gName}" created successfully!`);
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
    showToast("Group deleted successfully.");
  };

  const submitManualWithGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualPhone.trim()) return;
    const normalized = normalizePhone(manualPhone);
    setPendingContact({ name: manualName.trim(), phone: normalized });
    setContactStep(2);
  };

  const confirmPendingContact = async () => {
    if (!pendingContact) return;
    const tier = getUserTier();

    if (selectedGroup && tier === "free") {
      const currentGroupCount = contacts.filter((c) => c.group_category === selectedGroup).length;
      if (currentGroupCount >= 3) {
        showToast(`Free tier allows max 3 contacts per group (${selectedGroup} is full). Upgrade to Déloci Plus!`);
        setPendingContact(null);
        setPageView("main");
        setContactStep(1);
        return;
      }
    }

    const groupToPass = selectedGroup === null ? undefined : selectedGroup;
    const saved = await handleAddManualContact(groupToPass, pendingContact);
    if (saved) {
      setPendingContact(null);
      setPageView("main");
      setContactStep(1);
      setManualName("");
      setManualPhone("");
      setSelectedGroup(null);
      showToast("Contact added successfully!");
    }
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
  const groupContacts = contacts.filter((c) => c.group_category === activeGroupView);
  const directContacts = contacts.filter((c) => !c.group_category);

  // Reusable avatar component ensuring avatar image and Déloci member status
  const renderContactAvatar = (contact: Contact, sizeClass = "w-9 h-9", textClass = "text-xs") => (
    <div className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full border border-yellow-400/40 bg-zinc-900 ${textClass} font-black uppercase text-yellow-400`}>
      {contact.isLociUser && contact.avatar_url ? (
        <img src={contact.avatar_url} alt={contact.name} className="h-full w-full object-cover" />
      ) : (
        contact.name.slice(0, 2)
      )}
    </div>
  );

  return (
    <div className="w-full max-w-md mx-auto space-y-4 px-3 sm:px-0 pb-12 relative">
      {/* iOS 26 LIQUID GLASS BACKGROUND-AWARE TOAST */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-99999 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl text-black dark:text-white border border-zinc-300/50 dark:border-zinc-700/60 px-4 py-2.5 rounded-full shadow-2xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-3 max-w-[90vw]">
          <Sparkles className="w-4 h-4 text-yellow-500 shrink-0 fill-yellow-500" />
          <span className="text-[11px] font-black leading-tight truncate">{toastMessage}</span>
        </div>
      )}

      {/* LONG PRESS / RIGHT CLICK CONTEXT POPUP */}
      {contextContact && (
        <div className="fixed inset-0 z-99999 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 text-black dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 w-full max-w-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center space-x-2">
                {renderContactAvatar(contextContact, "w-8 h-8", "text-[10px]")}
                <div>
                  <h4 className="text-xs font-black">{contextContact.name}</h4>
                  <p className="text-[10px] font-mono text-zinc-400">{contextContact.phone}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setContextContact(null);
                  setContextMenuAction(null);
                }}
                className="p-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-black dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {contextMenuAction === "menu" || !contextMenuAction ? (
              <div className="space-y-2">
                {contextContact.group_category ? (
                  <button
                    type="button"
                    onClick={async () => {
                      // Remove from group (un-add -> move to direct contacts)
                      await handleAddManualContact(undefined, { name: contextContact.name, phone: contextContact.phone });
                      await handleDeleteContact(contextContact.id);
                      setContextContact(null);
                      setContextMenuAction(null);
                      showToast(`Removed ${contextContact.name} from ${contextContact.group_category}`);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-orange-500/10 text-orange-500 font-black text-xs flex items-center justify-center space-x-2 hover:bg-orange-500/20"
                  >
                    <UserMinus className="w-4 h-4" />
                    <span>Remove from group</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setContextMenuAction("select-group")}
                    className="w-full py-2.5 px-3 rounded-xl bg-yellow-400 text-black font-black text-xs flex items-center justify-center space-x-2 shadow-xs"
                  >
                    <Users className="w-4 h-4" />
                    <span>Add to a group</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    handleDeleteContact(contextContact.id);
                    setContextContact(null);
                    setContextMenuAction(null);
                    showToast("Contact deleted.");
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-red-500/10 text-red-500 font-black text-xs flex items-center justify-center space-x-2 hover:bg-red-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Contact</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Choose Group:</p>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {allGroups.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={async () => {
                        const tier = getUserTier();
                        const count = contacts.filter((c) => c.group_category === g.key).length;
                        if (tier === "free" && count >= 3) {
                          showToast(`Free tier allows max 3 contacts per group (${g.key} is full).`);
                          return;
                        }
                        await handleAddManualContact(g.key, { name: contextContact.name, phone: contextContact.phone });
                        await handleDeleteContact(contextContact.id);
                        setContextContact(null);
                        setContextMenuAction(null);
                        showToast(`Added ${contextContact.name} to ${g.key}`);
                      }}
                      className="w-full p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-left hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-between"
                    >
                      <span>{g.label}</span>
                      <span className="text-[10px] text-zinc-400">{contacts.filter(c => c.group_category === g.key).length} / 3</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GROUP ADD CHOOSER PAGEVIEW */}
      {pageView === "group-add-chooser" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPageView("main")}
              className="p-2.5 rounded-full bg-zinc-200/60 dark:bg-zinc-900/80 text-black dark:text-white flex items-center space-x-1.5 pr-4 border border-zinc-300/40 dark:border-zinc-800 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span className="text-xs font-bold">Back</span>
            </button>
            <span className="text-[10px] font-mono font-bold uppercase text-yellow-500 tracking-wider">Add to {activeGroupView}</span>
            <div className="w-10" />
          </div>

          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-3xl p-5 space-y-3 shadow-sm">
            <div className="space-y-0.5">
              <h3 className="text-xs font-black text-black dark:text-white">Choose Add Source</h3>
              <p className="text-[10px] text-zinc-400">Select how you want to add a guardian to {activeGroupView}.</p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPageView("pick-from-direct")}
                className="w-full p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-xs font-black flex items-center space-x-3 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-zinc-200 dark:border-zinc-700"
              >
                <FolderInput className="w-4 h-4 text-yellow-500" />
                <div className="text-left">
                  <p>From Direct Contacts List</p>
                  <p className="text-[9px] text-zinc-400 font-normal">Pick from your existing unassigned contacts</p>
                </div>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setSelectedGroup(activeGroupView);
                  await handleAutoPickContacts();
                  setPageView("main");
                }}
                className="w-full p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-xs font-black flex items-center space-x-3 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-zinc-200 dark:border-zinc-700"
              >
                <Users className="w-4 h-4 text-yellow-500" />
                <div className="text-left">
                  <p>From Device Contacts</p>
                  <p className="text-[9px] text-zinc-400 font-normal">Import straight from your phone address book</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedGroup(activeGroupView);
                  setContactStep(1);
                  setPageView("add-contact");
                }}
                className="w-full p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-xs font-black flex items-center space-x-3 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-zinc-200 dark:border-zinc-700"
              >
                <UserPlus className="w-4 h-4 text-yellow-500" />
                <div className="text-left">
                  <p>Manual Entry</p>
                  <p className="text-[9px] text-zinc-400 font-normal">Type name and phone number manually</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PICK FROM DIRECT CONTACTS LIST PAGEVIEW */}
      {pageView === "pick-from-direct" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPageView("group-add-chooser")}
              className="p-2.5 rounded-full bg-zinc-200/60 dark:bg-zinc-900/80 text-black dark:text-white flex items-center space-x-1.5 pr-4 border border-zinc-300/40 dark:border-zinc-800 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span className="text-xs font-bold">Back</span>
            </button>
            <span className="text-[10px] font-mono font-bold uppercase text-yellow-500 tracking-wider">Direct Contacts</span>
            <div className="w-10" />
          </div>

          <div className="space-y-3">
            <div className="px-1">
              <h3 className="text-xs font-black text-black dark:text-white">Select Direct Contact</h3>
              <p className="text-[10px] text-zinc-400">Choose a contact to add into {activeGroupView}.</p>
            </div>

            {directContacts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-300 px-4 py-8 text-center dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">No unassigned direct contacts available.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {directContacts.map((c) => (
                  <div
                    key={c.id}
                    onClick={async () => {
                      const tier = getUserTier();
                      const count = contacts.filter((item) => item.group_category === activeGroupView).length;
                      if (tier === "free" && count >= 3) {
                        showToast(`Free tier allows max 3 contacts per group (${activeGroupView} is full).`);
                        return;
                      }
                      await handleAddManualContact(activeGroupView || undefined, { name: c.name, phone: c.phone });
                      await handleDeleteContact(c.id);
                      setPageView("main");
                      showToast(`Added ${c.name} to ${activeGroupView}!`);
                    }}
                    className="flex items-center justify-between rounded-2xl border border-zinc-200/60 bg-white/80 px-3.5 py-3 dark:border-zinc-800/80 dark:bg-zinc-900/80 backdrop-blur-xl shadow-xs cursor-pointer hover:border-yellow-400 transition-all"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {renderContactAvatar(c, "w-9 h-9", "text-xs")}
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1">
                          <p className="truncate text-xs font-extrabold text-zinc-950 dark:text-white">{c.name}</p>
                          {c.isLociUser && (
                            <span className="bg-yellow-400 text-black text-[8px] px-1.5 py-0.2 rounded-full font-black uppercase">
                              Déloci Member
                            </span>
                          )}
                        </div>
                        <p className="truncate font-mono text-[10px] text-zinc-400">{c.phone}</p>
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-yellow-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAGEVIEW 1: ADD CONTACT STEP WIZARD */}
      {pageView === "add-contact" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (contactStep === 2) {
                  setContactStep(1);
                } else {
                  setPageView("main");
                  setSelectedGroup(null);
                }
              }}
              className="p-2.5 rounded-full bg-zinc-200/60 dark:bg-zinc-900/80 text-black dark:text-white flex items-center space-x-1.5 pr-4 border border-zinc-300/40 dark:border-zinc-800 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span className="text-xs font-bold">Back</span>
            </button>
            <span className="text-[10px] font-mono font-bold uppercase text-yellow-500 tracking-wider">
              Add Contact {contactStep === 1 ? "(Step 1 of 2)" : "(Step 2 of 2)"}
            </span>
            <div className="w-10" />
          </div>

          {contactStep === 1 ? (
            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-3xl p-4 space-y-3.5 shadow-sm animate-in fade-in">
              <div className="space-y-0.5">
                <h3 className="text-xs font-black text-black dark:text-white flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5 text-yellow-500" />
                  <span>Guardian Information</span>
                </h3>
                <p className="text-[10px] text-zinc-400">
                  Defaults to no group. Optionally choose a target group below.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">
                  Target Group (Optional)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    key="none"
                    type="button"
                    onClick={() => setSelectedGroup(null)}
                    className={`p-2.5 rounded-xl text-[11px] font-black text-left border transition-all ${
                      selectedGroup === null
                        ? "bg-yellow-400 text-black border-yellow-400 shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    None (Direct Contact)
                  </button>

                  {allGroups.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setSelectedGroup(g.key)}
                      className={`p-2.5 rounded-xl text-[11px] font-black text-left border transition-all ${
                        selectedGroup === g.key
                          ? "bg-yellow-400 text-black border-yellow-400 shadow-xs"
                          : "bg-zinc-100 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={handleAutoPickContacts}
                  disabled={importing}
                  className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold py-3 rounded-2xl text-[11px] flex items-center justify-center space-x-2 active:scale-95 transition-all shadow-md shadow-yellow-400/20"
                >
                  {importing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                  ) : (
                    <>
                      <Users className="w-3.5 h-3.5" />
                      <span>Import Phone Contact</span>
                    </>
                  )}
                </button>

                <form onSubmit={submitManualWithGroup} className="space-y-2.5 pt-1">
                  <input
                    type="text"
                    required
                    placeholder="Guardian Name"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-black dark:text-white focus:outline-none focus:border-yellow-400"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Phone (+233...)"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value.replace(/[\s\-\(\)]/g, ""))}
                    className="w-full bg-zinc-100 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-black dark:text-white focus:outline-none focus:border-yellow-400"
                  />
                  <button
                    type="submit"
                    className="w-full bg-yellow-400 text-black font-black py-3 rounded-xl text-[11px] flex items-center justify-center space-x-1.5 active:scale-95 transition-all shadow-md"
                  >
                    <span>Next Step</span>
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-3xl p-5 space-y-4 shadow-sm animate-in fade-in">
              <div className="space-y-0.5 text-center">
                <h3 className="text-xs font-extrabold text-black dark:text-white">Confirm Contact Details</h3>
                <p className="text-[11px] text-zinc-400">{pendingContact?.name}</p>
              </div>
              <p className="rounded-2xl bg-zinc-100 dark:bg-black border border-zinc-200 dark:border-zinc-800 px-3.5 py-4 text-center font-mono text-base font-bold text-yellow-500">
                {pendingContact ? formatPhonePreview(pendingContact.phone) : ""}
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setContactStep(1)}
                  className="rounded-xl border border-zinc-300 dark:border-zinc-700 py-2.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-300"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={confirmPendingContact}
                  disabled={addingContact}
                  className="rounded-xl bg-yellow-400 py-2.5 text-[11px] font-extrabold text-black disabled:opacity-50 shadow-md"
                >
                  {addingContact ? "Saving..." : "Confirm & Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PAGEVIEW 2: ADD GROUP */}
      {pageView === "add-group" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPageView("main")}
              className="p-2.5 rounded-full bg-zinc-200/60 dark:bg-zinc-900/80 text-black dark:text-white flex items-center space-x-1.5 pr-4 border border-zinc-300/40 dark:border-zinc-800 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span className="text-xs font-bold">Back</span>
            </button>
            <span className="text-[10px] font-mono font-bold uppercase text-yellow-500 tracking-wider">Create Group</span>
            <div className="w-10" />
          </div>

          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-3xl p-5 space-y-3.5 shadow-sm">
            <div className="space-y-0.5">
              <h3 className="text-xs font-extrabold text-black dark:text-white flex items-center space-x-1.5">
                <FolderPlus className="w-3.5 h-3.5 text-yellow-500" />
                <span>New Guardian Circle Group</span>
              </h3>
              <p className="text-[10px] text-zinc-400">
                Organize your guardians into custom circles.
              </p>
            </div>

            <div className="space-y-2.5">
              <input
                type="file"
                ref={groupImageInputRef}
                accept="image/*"
                onChange={handleGroupImageUpload}
                className="hidden"
              />

              <input
                type="text"
                placeholder="Group name (e.g. Neighbors, Roommates)"
                value={customGroupInput}
                onChange={(e) => setCustomGroupInput(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-black dark:text-white focus:outline-none focus:border-yellow-400"
              />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => groupImageInputRef.current?.click()}
                  className="inline-flex items-center space-x-1.5 text-[11px] font-extrabold text-yellow-600 dark:text-yellow-400 bg-yellow-400/10 px-3 py-1.5 rounded-xl border border-yellow-400/20 hover:bg-yellow-400/20 active:scale-95 transition-all"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{customGroupImage ? "Change Image" : "Upload Card Image"}</span>
                </button>

                {customGroupImage && (
                  <span className="text-[10px] text-emerald-500 font-extrabold">
                    ✓ Image Attached
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleCreateCustomGroup}
                className="w-full bg-yellow-400 text-black font-black py-3 rounded-2xl text-[11px] shadow-md mt-1"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTACTS PAGE VIEW */}
      {pageView === "main" && (
        <>
          {/* Subtab Toggle Bar */}
          <div className="p-1 bg-zinc-200/60 dark:bg-zinc-900/80 rounded-full grid grid-cols-2 gap-1 border border-zinc-300/40 dark:border-zinc-800">
            <button
              onClick={() => {
                setSubTab("contacts");
                setActiveGroupView(null);
              }}
              className={`py-2 rounded-full text-xs font-black transition-all flex items-center justify-center space-x-1.5 ${
                subTab === "contacts"
                  ? "bg-white dark:bg-zinc-800 text-black dark:text-white shadow-xs"
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
                  ? "bg-white dark:bg-zinc-800 text-black dark:text-white shadow-xs"
                  : "text-zinc-400 hover:text-black dark:hover:text-white"
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
              <span>Shared Sessions</span>
            </button>
          </div>

          {subTab === "contacts" && (
            <>
              <div className="flex items-center space-x-2 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setCircleView("contacts");
                    setActiveGroupView(null);
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-all border ${
                    circleView === "contacts"
                      ? "bg-yellow-400 text-black border-yellow-400 shadow-sm"
                      : "bg-zinc-100 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-300 border-zinc-300/60 dark:border-zinc-800 hover:border-zinc-400"
                  }`}
                >
                  Contacts ({contacts.length})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCircleView("groups");
                    setActiveGroupView(null);
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-all border ${
                    circleView === "groups"
                      ? "bg-yellow-400 text-black border-yellow-400 shadow-sm"
                      : "bg-zinc-100 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-300 border-zinc-300/60 dark:border-zinc-800 hover:border-zinc-400"
                  }`}
                >
                  Groups
                </button>
              </div>

              {circleView === "contacts" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <h2 className="text-sm font-black text-black dark:text-white">All Contacts</h2>
                      <p className="text-[10px] text-zinc-400">Long press any contact for more actions.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGroup(null);
                        setContactStep(1);
                        setPageView("add-contact");
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-400 text-black shadow-md shadow-yellow-400/20"
                      aria-label="Add contact"
                      title="Add contact"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {contacts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center dark:border-zinc-800">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">No trusted contacts yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {contacts.map((contact) => (
                        <div
                          key={contact.id}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextContact(contact);
                            setContextMenuAction("menu");
                          }}
                          onTouchStart={() => {
                            const timer = setTimeout(() => {
                              setContextContact(contact);
                              setContextMenuAction("menu");
                            }, 600);
                            (window as any).__pressTimer = timer;
                          }}
                          onTouchEnd={() => {
                            if ((window as any).__pressTimer) {
                              clearTimeout((window as any).__pressTimer);
                            }
                          }}
                          className="flex items-center justify-between rounded-2xl border border-zinc-200/60 bg-white/80 px-3.5 py-3 dark:border-zinc-800/80 dark:bg-zinc-900/80 backdrop-blur-xl shadow-xs select-none"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            {renderContactAvatar(contact, "w-9 h-9", "text-xs")}
                            <div className="min-w-0">
                              <div className="flex items-center space-x-1">
                                <p className="truncate text-xs font-extrabold text-zinc-950 dark:text-white">{contact.name}</p>
                                {contact.isLociUser && (
                                  <span className="bg-yellow-400 text-black text-[8px] px-1.5 py-0.2 rounded-full font-black uppercase">
                                    Déloci Member
                                  </span>
                                )}
                              </div>
                              <p className="truncate font-mono text-[10px] text-zinc-400">{contact.phone}</p>
                              <p className="text-[9px] text-zinc-500">{contact.group_category || "Direct Contact"}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            <a
                              href={`tel:${contact.phone}`}
                              className="p-2 rounded-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 active:scale-95 transition-all"
                              title="Call Contact"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`sms:${contact.phone}`}
                              className="p-2 rounded-full bg-yellow-400/10 text-yellow-500 hover:bg-yellow-400/20 active:scale-95 transition-all"
                              title="Text Contact"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteContact(contact.id)}
                              className="p-2 text-zinc-400 transition-colors hover:text-red-500"
                              aria-label={`Remove ${contact.name}`}
                              title="Remove contact"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : activeGroupView ? (
                <div className="space-y-3.5 animate-in fade-in slide-in-from-right-2">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setActiveGroupView(null)}
                      className="p-2 rounded-full bg-zinc-200/60 dark:bg-zinc-900/60 backdrop-blur-xl text-black dark:text-white active:scale-90 transition-all shadow-xs flex items-center space-x-1 pr-3 border border-zinc-300/40 dark:border-zinc-800"
                    >
                      <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                      <span className="text-xs font-bold">Groups</span>
                    </button>

                    <div className="flex items-center space-x-2">
                      {!activeGroupData?.isDefault && (
                        <button
                          onClick={(e) => handleDeleteCustomGroup(activeGroupView, e)}
                          className="p-2 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-90 border border-red-500/30"
                          title="Delete Custom Group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => setPageView("group-add-chooser")}
                        className="w-8 h-8 rounded-full bg-yellow-400 text-black flex items-center justify-center font-black active:scale-90 transition-all shadow-md shadow-yellow-400/20"
                      >
                        <Plus className="w-4 h-4 stroke-3" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-zinc-900 text-white p-4 rounded-3xl border border-zinc-800 relative overflow-hidden flex flex-col justify-end min-h-32 shadow-lg">
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
                      <span className="text-[9px] font-black uppercase text-yellow-400 tracking-wider">
                        Group Circle
                      </span>
                      <h3 className="text-lg font-extrabold text-white">{activeGroupView}</h3>
                      <p className="text-[11px] text-zinc-200">
                        {groupContacts.length} Linked Guardians in this circle
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {groupContacts.length === 0 ? (
                      <div className="text-center py-8 px-4 bg-white/60 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 rounded-3xl space-y-2">
                        <UserCheck className="w-7 h-7 text-zinc-500 mx-auto" />
                        <p className="text-xs font-extrabold text-black dark:text-white">
                          No contacts in {activeGroupView} yet
                        </p>
                        <button
                          onClick={() => setPageView("group-add-chooser")}
                          className="inline-flex items-center space-x-1.5 bg-yellow-400 text-black px-3.5 py-1.5 rounded-full text-xs font-black shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Guardian to {activeGroupView}</span>
                        </button>
                      </div>
                    ) : (
                      groupContacts.map((c) => (
                        <div
                          key={c.id}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextContact(c);
                            setContextMenuAction("menu");
                          }}
                          className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/50 px-3.5 py-3 rounded-2xl flex items-center justify-between shadow-xs select-none"
                        >
                          <div className="flex items-center space-x-2.5">
                            {renderContactAvatar(c, "w-9 h-9", "text-xs")}
                            <div>
                              <div className="flex items-center space-x-1">
                                <p className="text-xs font-extrabold text-black dark:text-white">
                                  {c.name}
                                </p>
                                {c.isLociUser && (
                                  <span className="bg-yellow-400 text-black text-[8px] px-1.5 py-0.2 rounded-full font-black uppercase">
                                    Déloci Member
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-mono text-zinc-400">{c.phone}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            <a
                              href={`tel:${c.phone}`}
                              className="p-2 rounded-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 active:scale-95 transition-all"
                              title="Call Contact"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`sms:${c.phone}`}
                              className="p-2 rounded-full bg-yellow-400/10 text-yellow-500 hover:bg-yellow-400/20 active:scale-95 transition-all"
                              title="Text Contact"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={async () => {
                                await handleAddManualContact(undefined, { name: c.name, phone: c.phone });
                                await handleDeleteContact(c.id);
                                showToast(`Removed ${c.name} from ${activeGroupView}`);
                              }}
                              className="p-1.5 text-zinc-400 hover:text-orange-500 transition-colors active:scale-90"
                              title="Remove from group"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <h2 className="text-sm font-black text-black dark:text-white">My Circle 🛡</h2>
                      <p className="text-[10px] text-zinc-400">
                        Organized guardian circles for instant safety dispatch.
                      </p>
                    </div>

                    <button
                      onClick={() => setPageView("add-group")}
                      className="w-9 h-9 rounded-full bg-yellow-400 text-black flex items-center justify-center active:scale-90 transition-all shadow-md shadow-yellow-400/20 border-2 border-yellow-300"
                      title="Create New Group"
                    >
                      <Plus className="w-5 h-5 stroke-3" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {allGroups.map((grp, idx) => {
                      const count = contacts.filter(
                        (c) => c.group_category === grp.key
                      ).length;

                      const isWide = idx === 0;

                      return (
                        <div
                          key={grp.key}
                          onClick={() => setActiveGroupView(grp.key)}
                          className={`p-3.5 rounded-3xl ${grp.accent} border relative overflow-hidden cursor-pointer active:scale-95 transition-all shadow-xs flex flex-col justify-between group ${
                            isWide ? "col-span-2 min-h-32" : "min-h-36"
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
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${grp.badgeBg}`}>
                              {count} Linked
                            </span>

                            {!grp.isDefault && (
                              <button
                                onClick={(e) => handleDeleteCustomGroup(grp.key, e)}
                                className="p-1 rounded-full bg-black/60 backdrop-blur-md text-zinc-300 hover:text-red-400 hover:bg-black/80 active:scale-90 transition-all border border-zinc-700/60"
                                title="Delete Custom Group"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          <div className="relative z-10 pt-3">
                            <h3 className="text-xs font-black text-white drop-shadow-md">{grp.label}</h3>
                            <p className="text-[9px] text-zinc-200 line-clamp-1 opacity-90 drop-shadow-md">
                              {grp.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {subTab === "shared" && (
            <SharedSessionsPage
              userPhone={userPhone}
              currentUserId={currentUserId}
              contacts={contacts}
              openSessionId={openSessionId}
              onSessionOpened={onSessionOpened}
            />
          )}
        </>
      )}
    </div>
  );
}