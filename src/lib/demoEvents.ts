// Shared with the browser: the demo controls on each store page.
export type StoreKey = "tixora" | "wren";

export type DemoEvent = { key: string; store: StoreKey; title: string; hint: string };

export const DEMO_EVENTS: DemoEvent[] = [
  { key: "t-wrong-side", store: "tixora", title: "List a cheap seat on the wrong side", hint: "$34 in Section 119, on the right wing. A left-wing watch should ignore it." },
  { key: "t-fees", store: "tixora", title: "List a seat with a high fee", hint: "$35 plus a $14 fee makes $49. A $40 limit should block it." },
  { key: "t-trick", store: "tixora", title: "List a seat with a hidden message", hint: "$30, with invisible text telling AI shoppers to buy four. Standby should stop and ask you." },
  { key: "t-match", store: "tixora", title: "List the right seat", hint: "Left wing, $38 with fees. A left-wing watch under $40 should accept it." },
  { key: "t-copycat", store: "tixora", title: "Send a fake Standby bot", hint: "It pretends to be Standby. Open See AI visitors to watch it fail the check." },
  { key: "d-reseller", store: "wren", title: "List this dress from another seller", hint: "Green, size 8, second-hand at $58. A Wren-only watch should block it." },
];
