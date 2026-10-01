"use client";

import React, { useState, useEffect } from "react";
import { X, Share, PlusSquare, CheckCircle2, Smartphone, Monitor, Download } from "lucide-react";

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InstallModal({ isOpen, onClose }: InstallModalProps) {
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5 text-zinc-900 dark:text-zinc-100 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 bg-yellow-400 text-black rounded-xl flex items-center justify-center font-extrabold shadow-sm">
              {isIOS ? <Smartphone className="w-5 h-5 text-black" /> : <Monitor className="w-5 h-5 text-black" />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-black dark:text-white leading-tight">
                Install Loci
              </h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {isIOS ? "iOS & Safari Instructions" : "Windows / Desktop Instructions"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions Steps */}
        <div className="space-y-4">
          {isIOS ? (
            /* iOS Instructions */
            <>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
                To install Loci as a standalone app on your iPhone or iPad, follow these 3 steps in Safari:
              </p>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-start space-x-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/50">
                  <div className="p-2 bg-yellow-400 text-black rounded-xl shrink-0 font-extrabold text-xs">1</div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-black dark:text-white flex items-center gap-1.5">
                      Tap Share <Share className="w-3.5 h-3.5 text-yellow-500 inline" />
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">At the bottom Safari bar.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/50">
                  <div className="p-2 bg-yellow-400 text-black rounded-xl shrink-0 font-extrabold text-xs">2</div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-black dark:text-white flex items-center gap-1.5">
                      "Add to Home Screen" <PlusSquare className="w-3.5 h-3.5 text-yellow-500 inline" />
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Scroll down in the share menu.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/50">
                  <div className="p-2 bg-yellow-400 text-black rounded-xl shrink-0 font-extrabold text-xs">3</div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-black dark:text-white flex items-center gap-1.5">
                      Tap "Add" <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" />
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Top-right corner to finish!</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Windows / Desktop Chrome / Edge Instructions */
            <>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
                To install Loci on Windows (Chrome, Edge, or Brave):
              </p>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-start space-x-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/50">
                  <div className="p-2 bg-yellow-400 text-black rounded-xl shrink-0 font-extrabold text-xs">1</div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-black dark:text-white flex items-center gap-1.5">
                      Look at Address Bar <Download className="w-3.5 h-3.5 text-yellow-500 inline" />
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Click the small "Install Loci" icon on the far right of your browser URL bar.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/50">
                  <div className="p-2 bg-yellow-400 text-black rounded-xl shrink-0 font-extrabold text-xs">2</div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-black dark:text-white">Or via Browser Menu</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Click <strong>&hellip; (Menu) &rarr; Cast, Save and Share &rarr; Install Loci...</strong>
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold py-3 rounded-2xl text-xs transition-all active:scale-[0.98] shadow-md shadow-yellow-400/20"
        >
          Got It
        </button>
      </div>
    </div>
  );
}