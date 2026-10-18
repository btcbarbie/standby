// Shared with the browser: the demo controls on each store page.
export type StoreKey = "tixora" | "wren";

export type DemoEvent = { key: string; store: StoreKey; title: string; hint: string };

export const DEMO_EVENTS: DemoEvent[] = [
  { key: "t-wrong-side", store: "tixora", title: "$34 seat in Section 119", hint: "Cheap, but it's the right wing." },
  { key: "t-fees", store: "tixora", title: "$35 seat in Section 103", hint: "Left wing, but a $14 fee at checkout." },
  { key: "t-trick", store: "tixora", title: "$30 seat with a hidden message", hint: "The listing hides instructions aimed at AI shoppers." },
  { key: "t-match", store: "tixora", title: "$32 seat in Section 106", hint: "Left wing, $38 with fees. The real deal." },
  { key: "t-copycat", store: "tixora", title: "A copycat bot visits", hint: "Claims to be Standby, but changed what it says it may do." },
  { key: "d-black", store: "wren", title: "Black / 8 restocked", hint: "Right size, wrong colour." },
  { key: "d-reseller", store: "wren", title: "Green / 8 from a reseller", hint: "Same dress, sold by someone else at $58." },
  { key: "d-match", store: "wren", title: "Green / 8 back in stock", hint: "Wren restocks your exact size." },
];
