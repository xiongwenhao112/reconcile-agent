const en = {
  // Header
  "app.title": "Reconcile Agent",
  "app.subtitle": "Auto-reconcile orders, payment records & platform bills — find every mismatch",

  // Empty state
  "empty.title": "Reconcile Agent",
  "empty.hint": "I'm your dedicated reconciliation assistant. Send me your order sheets, payment records, and platform bills — I'll match them line by line: unmatched records, amount discrepancies, duplicates... nothing slips through.",
  "empty.features": "Multi-sheet matching · Amount comparison · Duplicate detection · Discrepancy report",

  // Chat input
  "chat.placeholder": "Type or upload files…  ⏎ Send · Shift+⏎ Newline",
  "chat.hint": "Supports Excel/CSV/TXT uploads (max 10MB) · Drag & drop or Ctrl+V to paste files · Data used in current session only",

  // Preset questions
  "preset.1": "I have an order sheet and a payment record — help me find which orders have no matching payment.",
  "preset.2": "Reconcile my order sheet, payment record, and platform bill together — find all differences.",
  "preset.4": "Check this data for duplicate records and abnormal amounts.",
  "preset.screenshotEdgeOne": "Take a screenshot of edgeone.ai.",
  "preset.skill.sandboxAlgorithms": "Calculate the first 20 Fibonacci numbers and provide the execution result.",

  // Tool indicators
  "tool.commands": "Commands",
  "tool.files": "Files",
  "tool.codeRunner": "Data Engine",
  "tool.browser": "Browser",

  // Web search activity (in-bubble chip)
  "webSearch.error.wsaMissing": "Web search unavailable — needs a {0} API key",
  "webSearch.error.wsaCta": "Get a key",

  // Skill indicators
  "skill.sandboxAlgorithms": "Sandbox Algorithms",

  // Debug panel
  "debug.title": "Trace",
  "debug.events": "events",
  "debug.clear": "Clear",
  "debug.empty": "Waiting for SSE events...",
  "debug.emptyHint": "After sending a message, all raw backend data will be displayed here.",

  // Status & errors
  "status.error": "Request failed. Please check if the backend service is running.",
  "status.stopped": "⏹ *Generation stopped*",
  "status.backendError": "Backend abort request failed. The server may still be running.",

  // Language toggle
  "lang.switch": "中文",

  // Sidebar
  "sidebar.label": "Reconciliation records",
  "sidebar.title": "Records",
  "sidebar.newChat": "New reconciliation",
  "sidebar.loading": "Loading records...",
  "sidebar.loadMore": "Load more",
  "sidebar.loadingMore": "Loading...",
  "sidebar.emptyTitle": "No records yet",
  "sidebar.emptyHint": "Click \"New reconciliation\" to start your first check.",
  "sidebar.delete": "Delete record",
  "sidebar.deleteConfirm": "Permanently delete this reconciliation record? This cannot be undone.",

  // Aria labels (button hover/screen-reader)
  "aria.send": "Send",
  "aria.clearHistory": "Clear history",
  "aria.stopGeneration": "Stop generation",

  // ─── Floating bottom-right action badges ─────────────────────────────
  "floatingLink.deploy": "Deploy",
  "floatingLink.github": "GitHub",
} as const;

export default en;
