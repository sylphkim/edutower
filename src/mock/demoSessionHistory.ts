import type { DemoSessionMessage } from "../types/chatContext";

export const demoSessionHistory: DemoSessionMessage[] = [
  {
    id: "session-msg-001",
    role: "user",
    content: "老师，我还是不太会把二次函数一般式变成顶点式。",
    createdAt: "2026-05-31T01:20:00.000Z"
  },
  {
    id: "session-msg-002",
    role: "assistant",
    content: "可以先把二次项系数提出去，再对括号内的一次项配方。我们用 y = 2x^2 - 8x + 3 试一次。",
    createdAt: "2026-05-31T01:21:00.000Z"
  },
  {
    id: "session-msg-003",
    role: "user",
    content: "我能配到 2(x - 2)^2，但后面的常数总是算错。",
    createdAt: "2026-05-31T01:23:00.000Z"
  },
  {
    id: "session-msg-004",
    role: "assistant",
    content: "关键是补进去的 4 在括号里会被外面的 2 放大成 8，所以外面要减 8，最后得到 y = 2(x - 2)^2 - 5。",
    createdAt: "2026-05-31T01:24:00.000Z"
  },
  {
    id: "session-msg-005",
    role: "user",
    content: "那如果题目问最大利润，我是不是直接取顶点的 y 值？",
    createdAt: "2026-05-31T01:28:00.000Z"
  },
  {
    id: "session-msg-006",
    role: "assistant",
    content: "先看利润函数的开口方向和自变量定义域。如果顶点在定义域内，再取顶点值；如果不在，就比较定义域端点。",
    createdAt: "2026-05-31T01:29:00.000Z"
  }
];
