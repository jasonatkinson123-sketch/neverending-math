export type VoiceRecovery = "retry" | "typing";

export function voiceRecovery(error: string, failureCount: number): VoiceRecovery {
  if (["not-allowed", "service-not-allowed", "audio-capture"].includes(error)) return "typing";
  return failureCount >= 3 ? "typing" : "retry";
}
