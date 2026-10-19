// How the three checks combine. One function, used by the live watcher and by the recorded homepage examples,
// so both always follow exactly the same rules.
//   Vault says no                -> BLOCKED  (code limits are final)
//   Scout and Banker both no     -> SKIPPED
//   Both yes, alert mode         -> FOUND    (you're told; you pay)
//   Both yes, buy mode           -> BUY      (paid from your hold)
//   Anything else (disagreement, or a red flag) -> NEEDS_YOU

export type Ruling = "BLOCKED" | "SKIPPED" | "FOUND" | "BUY" | "NEEDS_YOU";

export function ruling(input: { vaultPass: boolean; scoutYes: boolean; bankerApproves: boolean; redFlags: number; mode: string }): Ruling {
  const bankerYes = input.bankerApproves && input.redFlags === 0;
  if (!input.vaultPass) return "BLOCKED";
  if (!input.scoutYes && !bankerYes && input.redFlags === 0) return "SKIPPED";
  if (input.scoutYes && bankerYes) return input.mode === "ALERT" ? "FOUND" : "BUY";
  return "NEEDS_YOU";
}
