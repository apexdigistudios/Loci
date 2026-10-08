let alertAudioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return null;
  alertAudioContext ??= new AudioContextConstructor();
  return alertAudioContext;
}

export async function prepareAlertFeedback() {
  const context = getAudioContext();
  if (context?.state === "suspended") {
    try {
      await context.resume();
    } catch (error) {
      console.warn("Could not prepare alert audio:", error);
    }
  }
}

export function triggerAlertFeedback() {
  if (typeof window === "undefined") return;

  if ("vibrate" in navigator) {
    navigator.vibrate([300, 100, 300, 100, 500]);
  }

  const context = getAudioContext();
  if (!context) return;

  try {
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime;
    const notes = [880, 660, 880];

    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = now + index * 0.16;
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.13);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.14);
    });
  } catch (error) {
    console.warn("Could not play alert sound:", error);
  }
}

export async function sendPushAlert(
  userIds: string | string[],
  title: string,
  message: string,
  url: string = "/"
) {
  if (!userIds) return;
  const targetIds = Array.isArray(userIds) ? userIds.filter(Boolean) : [userIds];
  if (targetIds.length === 0) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return;

  try {
    // Send batch array payload in a single HTTP request for instant execution
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        action: "send",
        userIds: targetIds,
        title,
        body: message,
        url,
        tag: "deloci-safety-alert",
      }),
    });
  } catch (error) {
    console.error("Failed to dispatch push alert:", error);
  }
}