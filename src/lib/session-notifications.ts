import { notifyReceiverContacts } from "@/lib/receiver-push";

// --- EVENT 1: SENDER STARTS SESSION ---
export async function onSessionStarted(
  senderName: string,
  destination: string,
  contactPhones: string[]
) {
  return await notifyReceiverContacts({
    contactPhones,
    title: "📍 Journey Check-In Started",
    body: `${senderName} started a session for their journey to ${destination}. Keep an eye out!`,
  });
}

// --- EVENT 2: SENDER CHECKS IN ---
export async function onSenderCheckedIn(
  senderName: string,
  contactPhones: string[]
) {
  return await notifyReceiverContacts({
    contactPhones,
    title: "✅ Safe Check-In",
    body: `${senderName} has just checked in safely.`,
  });
}

// --- EVENT 3: SENDER ENDS SESSION ---
export async function onSessionEnded(
  senderName: string,
  contactPhones: string[]
) {
  return await notifyReceiverContacts({
    contactPhones,
    title: "🎉 Trip Completed",
    body: `${senderName} has safely reached their destination and ended the session.`,
  });
}

// --- EVENT 4: OVERDUE GUARDIAN ALERT (Critical Safety Escalation) ---
export async function onSessionOverdue(
  senderName: string,
  destination: string,
  contactPhones: string[]
) {
  return await notifyReceiverContacts({
    contactPhones,
    title: "🚨 URGENT: Missed Check-In Alert",
    body: `${senderName} was expected at ${destination} and hasn't checked in! Please reach out immediately.`,
  });
}
