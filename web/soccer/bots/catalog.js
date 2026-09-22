
const pl = [
  {
    id: "seer",
    name: "Seer v0",
    rank: "Platinum",
    description: "A Platinum-level challenger.",
    modelUrl: new URL("../../assets/bot/seer/policy.onnx", import.meta.url).href,
    noticeUrl: new URL("../../assets/bot/seer/NOTICE.txt", import.meta.url).href,
    credit: "Seer v0 by Neville Walo · MIT",
    tickSkip: 8,
    scriptedKickoff: !1,
  },
  {
    id: "necto",
    name: "Necto",
    rank: "Diamond",
    description: "A Diamond-level challenger.",
    modelUrl: new URL("../../assets/bot/necto/policy.onnx", import.meta.url).href,
    noticeUrl: new URL("../../assets/bot/necto/NOTICE.txt", import.meta.url).href,
    credit: "Necto by the Necto team · CC BY-NC-SA 4.0",
    tickSkip: 8,
    scriptedKickoff: !1,
  },
  {
    id: "nexto",
    name: "Nexto",
    rank: "GC",
    description: "A Grand Champion-level challenger.",
    modelUrl: new URL("../../assets/bot/policy.onnx", import.meta.url).href,
    noticeUrl: new URL("../../assets/bot/NOTICE.txt", import.meta.url).href,
    credit: "Nexto by the Necto team · CC BY-NC-SA 4.0",
    tickSkip: 8,
    scriptedKickoff: !0,
  },
];

function JA(i) {
  return pl.find((e) => e.id === i);
}

export { JA, pl };
