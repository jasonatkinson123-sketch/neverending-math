import assert from "node:assert/strict";
import test from "node:test";
import { voiceRecovery } from "../app/voice-policy.ts";

test("permission and audio-device failures fall back without retry loops", () => {
  for (const error of ["not-allowed", "service-not-allowed", "audio-capture"])
    assert.equal(voiceRecovery(error, 1), "typing");
});

test("temporary recognition errors retry only a bounded number of times", () => {
  assert.equal(voiceRecovery("no-speech", 1), "retry");
  assert.equal(voiceRecovery("network", 2), "retry");
  assert.equal(voiceRecovery("no-speech", 3), "typing");
});
