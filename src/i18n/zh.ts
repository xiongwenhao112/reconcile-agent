const zh = {
  // Header
  "app.title": "对账核对员",
  "app.subtitle": "自动核对订单表、收款流水与平台账单，逐条找出差异",

  // Empty state
  "empty.title": "对账核对员",
  "empty.hint": "我是你的专属对账助手。把订单表、收款流水、平台账单发给我，我会逐条核对：一方有另一方没有的、金额不一致的、重复记录……所有差异一个不落。",
  "empty.features": "多表核对 · 金额比对 · 重复检测 · 差异报告",

  // Chat input
  "chat.placeholder": "粘贴数据或描述对账需求…  ⏎ 发送 · Shift+⏎ 换行",
  "chat.hint": "支持上传 Excel/CSV 文件或直接粘贴表格数据 · 数据仅在当前会话中使用",

  // Preset questions
  "preset.1": "我有一份订单表和一份收款流水，帮我核对一下有哪些订单没收款。",
  "preset.2": "帮我把订单表、收款流水、平台账单三份数据放在一起核对，找出所有差异。",
  "preset.4": "帮我检查这份数据有没有重复记录和异常金额。",
  "preset.screenshotEdgeOne": "截取 edgeone.ai 的网页图片。",
  "preset.skill.sandboxAlgorithms": "计算斐波那契数列前 20 个，并给出执行结果。",

  // Tool indicators
  "tool.commands": "终端命令",
  "tool.files": "文件操作",
  "tool.codeRunner": "数据计算",
  "tool.browser": "浏览器",

  // Web search activity (in-bubble chip)
  "webSearch.error.wsaMissing": "搜索不可用，需配置 {0} API Key",
  "webSearch.error.wsaCta": "获取 Key",

  // Skill indicators
  "skill.sandboxAlgorithms": "沙箱算法执行",

  // Debug panel
  "debug.title": "传输流",
  "debug.events": "事件",
  "debug.clear": "清除",
  "debug.empty": "等待 SSE 事件...",
  "debug.emptyHint": "发送消息后，所有原始后端数据将在此处显示。",

  // Status & errors
  "status.error": "⚠️ 请求失败，请检查后端服务是否启动。",
  "status.stopped": "⏹ *已停止生成*",
  "status.backendError": "⚠️ 后端中断请求失败，服务端可能仍在运行。",

  // Language toggle
  "lang.switch": "English",

  // Sidebar
  "sidebar.label": "对账记录列表",
  "sidebar.title": "对账记录",
  "sidebar.newChat": "新建对账",
  "sidebar.loading": "正在加载对账记录...",
  "sidebar.loadMore": "加载更多",
  "sidebar.loadingMore": "加载中...",
  "sidebar.emptyTitle": "暂无对账记录",
  "sidebar.emptyHint": "点击「新建对账」开始第一次核对。",
  "sidebar.delete": "删除对账记录",
  "sidebar.deleteConfirm": "确定要永久删除这条对账记录吗？此操作不可恢复。",

  // Aria labels (button hover/screen-reader)
  "aria.send": "发送",
  "aria.clearHistory": "清除历史",
  "aria.stopGeneration": "停止生成",

  // ─── Floating bottom-right action badges ─────────────────────────────
  "floatingLink.deploy": "一键部署",
  "floatingLink.github": "GitHub",
} as const;

export default zh;
