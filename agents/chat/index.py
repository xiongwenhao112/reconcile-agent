"""
Claude Agent SDK chat handler — EdgeOne Makers agent-python format.

Route: POST /chat
Response: SSE stream (text/event-stream)

SSE event protocol:
  event: text_delta  data: {"delta": "..."}
  event: tool_called data: {"tool": "ToolName"}
  event: image       data: {"imageId": "...", "base64": "...", "mimeType": "...", "size": ...}
  event: ping        data: {"ts": 1710000000000}
  event: error       data: {"message": "..."}
  event: done        data: {"stopped": false}

Session persistence:
  Uses ctx.store to save user/assistant messages for /history recovery.

Tools:
  EdgeOne platform sandbox tools (commands/files/code_interpreter/browser)
  bridged via Claude SDK's MCP Server mechanism.
"""

from __future__ import annotations

import asyncio
import base64
import os
import time
from typing import Any, AsyncGenerator
from uuid import UUID

from dotenv import load_dotenv

load_dotenv()

try:
    from claude_agent_sdk import (
        ClaudeAgentOptions,
        create_sdk_mcp_server,
        query,
    )
    _SDK_AVAILABLE = True
except ImportError:
    _SDK_AVAILABLE = False

from .._model import collect_gateway_env, resolve_model_name
from .._logger import create_logger
from ._stream import (
    StreamState,
    iter_query_messages,
    sanitize_assistant_text,
    sdk_message_to_sse,
    sse_event,
)


logger = create_logger("chat")
HEARTBEAT_INTERVAL_S = 5
MCP_SERVER_NAME = "edgeone"

SYSTEM_PROMPT = (
  '你是「对账核对员」—— 一个专业的财务对账助手。你的职责是帮助用户核对订单表、收款流水、平台账单等数据，自动找出差异并生成清晰的对账报告。\n\n'
  '## 核心能力\n'
  '你能够接收用户上传的表格数据（Excel/CSV/直接粘贴的数据），并对以下场景进行核对：\n'
  '1. **订单表 vs 收款流水**：检查每一笔订单是否都有对应的收款记录，金额是否一致。\n'
  '2. **订单表 vs 平台账单**：检查订单在平台账单中是否有对应记录，手续费等是否匹配。\n'
  '3. **三方核对**：同时核对订单表、收款流水、平台账单三份数据的一致性。\n'
  '4. **单表自查**：对单份数据进行检查，发现重复记录、异常金额、缺失字段等问题。\n\n'
  '## 对账规则\n'
  '在核对数据时，你必须逐条执行以下检查，并明确报告每种差异：\n'
  '- **一方有、另一方没有**：找出在 A 表存在但 B 表不存在的记录（根据订单号/交易号等关键字段匹配）。\n'
  '- **金额不一致**：两表中同一笔订单的金额不同，标注差异金额和方向。\n'
  '- **重复记录**：同一张表中出现相同订单号/交易号的重复行。\n'
  '- **状态不一致**：订单状态在两张表中不匹配（如：订单表显示"已支付"但收款流水中无对应记录）。\n'
  '- **时间异常**：收款时间早于订单创建时间等不合理情况。\n\n'
  '## 工作流程\n'
  '1. 如果用户上传了文件（Excel/CSV），先用 files 工具读取文件内容，然后用 code_interpreter 解析数据。\n'
  '2. 如果用户直接粘贴了表格数据，直接用 code_interpreter 解析。\n'
  '3. 确认每份数据的列名和关键字段（如：订单号、交易号、金额、时间等）。\n'
  '4. 与用户确认对账维度（用哪个字段做关联匹配）。\n'
  '5. 执行对账逻辑，逐条输出差异明细。\n'
  '6. 最后生成汇总报告，包括：总笔数、匹配成功数、差异数（按类型分类）、差异率。\n\n'
  '## 报告格式要求\n'
  '对账结果必须使用 Markdown 表格展示差异明细，包含以下列：\n'
  '- 差异类型（如：仅有订单无收款 / 金额不一致 / 重复记录等）\n'
  '- 关联键值（如订单号）\n'
  '- 具体差异描述\n'
  '- 差异金额（如有）\n\n'
  '汇总部分用清晰的统计数据呈现。如果差异较多（>50条），可以只展示前50条差异明细，其余给出统计。\n\n'
  '## 可用工具\n'
  '- **files**：读取用户上传的 Excel/CSV 文件。参数：op（read/write/list/exists/makeDir/remove），path，content（write 时需要）。\n'
  '- **code_interpreter**：执行 Python 代码进行数据解析和对账计算。参数：language（如 "python"），code。\n'
  '- **commands**：执行 shell 命令（如安装 Python 依赖）。\n'
  '- **browser**：如需从网页获取参考信息（如汇率、手续费标准等）。\n\n'
  '## 工具使用规则\n'
  '1. 读取用户文件前，先用 files list 确认文件存在。\n'
  '2. 对账逻辑全部用 Python（pandas）在 code_interpreter 中完成。\n'
  '3. 一次只调用一个工具，等待结果后再决定下一步。\n'
  '4. 如果工具调用失败，简要说明原因并尝试修正，不要盲目重试。\n'
  '5. 不要编造或模拟工具返回结果。\n'
  '6. 如果用户只是咨询对账方法而非实际对账，直接回答即可，不需要使用工具。\n'
  '7. 如果工具返回了图片或截图，不要在文本中包含 base64 或 data:image URL，只需简单说明图片已展示。\n\n'
  '## 交互风格\n'
  '- 专业、细致、耐心。对账是精细活，不要遗漏任何差异。\n'
  '- 如果用户提供的数据不完整或格式不规范，主动指出并给出建议。\n'
  '- 对账结果用清晰的中文呈现，表格对齐、数字格式化（保留两位小数、千分位分隔）。\n'
  '- 首次对话时，主动介绍自己是对账核对员，并引导用户提供需要核对的数据。'
)


def _normalize_uuid(value: str) -> str | None:
    """Return canonical UUID string, or None if value is not a valid UUID."""
    try:
        return str(UUID(value))
    except (TypeError, ValueError):
        return None


def _parse_uploaded_files(body: dict) -> tuple[list[dict], str]:
    """
    Parse uploaded files from request body (FormData parsed by EdgeOne).
    
    Returns (files_list, augmented_message) where:
    - files_list: list of dicts with name/type/data (base64)
    - augmented_message: original message with file context appended
    
    Handles two scenarios:
    1. FormData (multipart): body contains file_name_0, file_type_0, file_data_0, etc.
    2. JSON: body has a 'files' array (fallback).
    """
    files = []
    
    # Check for FormData-style keys
    file_count_str = body.get("file_count")
    if file_count_str:
        try:
            file_count = int(file_count_str)
            for i in range(file_count):
                name = body.get(f"file_name_{i}", f"file_{i}")
                ftype = body.get(f"file_type_{i}", "application/octet-stream")
                data = body.get(f"file_data_{i}", "")
                if data:
                    files.append({"name": name, "type": ftype, "data": data})
        except (ValueError, TypeError):
            pass
    
    # Fallback: JSON files array
    if not files:
        json_files = body.get("files")
        if isinstance(json_files, list):
            files = json_files
    
    return files


def _augment_message_with_files(user_message: str, files: list[dict]) -> str:
    """
    Augment the user message with file context so the agent knows about uploaded files.
    """
    if not files:
        return user_message
    
    file_names = [f.get("name", f"file_{i}") for i, f in enumerate(files)]
    file_list = "\n".join(f"- {name}" for name in file_names)
    
    file_context = (
        f"\n\n[用户上传了以下文件，请先用 files 工具读取它们的内容进行对账分析：]\n"
        f"{file_list}"
    )
    
    # If user message is empty or generic, provide a clear instruction
    if not user_message.strip() or user_message.strip() == "请帮我对账以下文件":
        return f"请帮我对账以下上传的文件：\n{file_list}\n\n请先读取每个文件的内容，了解其列名和数据结构，然后进行逐条对账分析。"
    
    return user_message + file_context


async def resolve_claude_session_binding(
    session_store: Any,
    conversation_id: str,
) -> tuple[str | None, str | None]:
    """
    Bind Claude SDK session to frontend conversation_id.

    First request for a conversation uses session_id=<conversation_id> to create
    a deterministic SDK session. Later requests use resume=<conversation_id>
    when that transcript already exists in session_store.
    """
    session_id = _normalize_uuid(conversation_id)
    if not session_id:
        logger.log(f"[session] skip SDK session binding: invalid conversation_id={conversation_id!r}")
        return None, None

    try:
        from claude_agent_sdk._internal.sessions import project_key_for_directory

        # project_key is load-bearing: EdgeOne ClaudeSessionStore.load() uses it
        # as a namespace prefix on blob keys. Drop it and load() returns None.
        project_key = project_key_for_directory(os.getcwd())
        entries = await session_store.load({"project_key": project_key, "session_id": session_id})
        if entries:
            logger.log(f"[session] resume Claude SDK session_id={session_id}, entries={len(entries)}")
            return None, session_id
        logger.log(f"[session] create Claude SDK session_id={session_id}")
    except Exception as e:
        logger.error(f"[session] failed to inspect session_store for resume: {e}")

    return session_id, None


def build_agent_options(
    session_store=None,
    mcp_server=None,
    mcp_server_name: str = MCP_SERVER_NAME,
    allowed_tools: list[str] | None = None,
    session_id: str | None = None,
    resume: str | None = None,
) -> "ClaudeAgentOptions":
    """Build Claude Agent SDK options. EdgeOne tools come from MCP."""
    cwd = os.getcwd()
    skill_read_allow_rules = [
        "Read(.claude/skills/**)",
        f"Read({cwd}/.claude/skills/**)",
    ]
    # Merge incoming MCP tool names with the built-in Read scoping rules.
    # The Python SDK's `settings` field only accepts a JSON-file path
    # (str | None), unlike the TS SDK which also accepts an inline Settings
    # dict. Trying to pass a dict raises CLIConnectionError("Failed to start
    # Claude Code: expected str, bytes or os.PathLike object, not dict") at
    # subprocess launch. So we route the same `permissions.allow` intent
    # through `allowed_tools` instead — the CLI treats both as auto-allow
    # rules with identical syntax.
    merged_allowed_tools = list(
        dict.fromkeys((allowed_tools or []) + skill_read_allow_rules)
    )
    opts = ClaudeAgentOptions(
        model=resolve_model_name(),
        system_prompt=SYSTEM_PROMPT,
        cwd=cwd,
        # Keep Claude Code's built-in tools narrowly scoped: Skill loads
        # project skills, and Read may only access .claude/skills resources.
        # EdgeOne sandbox tools are exposed separately through MCP below.
        tools=["Skill", "Read"],
        allowed_tools=merged_allowed_tools,
        setting_sources=["project"],
        skills="all",
        permission_mode="dontAsk",
        max_turns=5,
        env=collect_gateway_env(),
        include_partial_messages=True,
        max_buffer_size=20 * 1024 * 1024,  # 20MB — enough for browser screenshots
        session_id=session_id,
        resume=resume,
    )
    if session_store is not None:
        opts.session_store = session_store
    if mcp_server is not None:
        opts.mcp_servers = {mcp_server_name: mcp_server}
    return opts


async def handler(ctx: Any) -> AsyncGenerator[str, None]:
    """EdgeOne Makers entry point (async generator streaming)."""
    cid = ctx.conversation_id or ""
    logger.log(f"[chat] entered with cid={cid!r}")

    body = ctx.request.body
    user_message: str = body.get("message", "") if isinstance(body, dict) else ""
    
    # Parse uploaded files
    uploaded_files = _parse_uploaded_files(body) if isinstance(body, dict) else []
    
    # Write uploaded files to working directory so the agent's `files` tool can read them
    if uploaded_files:
        try:
            for f in uploaded_files:
                fname = f.get("name", "uploaded_file")
                fdata = f.get("data", "")
                if fdata:
                    # Ensure safe filename
                    safe_name = os.path.basename(fname) or "uploaded_file"
                    file_path = os.path.join(os.getcwd(), safe_name)
                    with open(file_path, "wb") as fh:
                        fh.write(base64.b64decode(fdata))
                    logger.log(f"[upload] saved: {safe_name} ({len(fdata)} b64 chars)")
        except Exception as e:
            logger.error(f"[upload] failed to write files: {e}")
    
    # Augment user message with file context
    user_message = _augment_message_with_files(user_message, uploaded_files)
    
    if not user_message.strip():
        yield sse_event("error", {"message": "'message' is required"})
        yield sse_event("done", {"stopped": False})
        return

    # Extract frontend-generated message IDs for history alignment
    user_msg_id: str = body.get("userMsgId", "") if isinstance(body, dict) else ""
    bot_msg_id: str = body.get("botMsgId", "") if isinstance(body, dict) else ""

    # Extract user ID for store scoping
    raw_user_id = body.get("userId") or body.get("user_id") or "" if isinstance(body, dict) else ""
    user_id = str(raw_user_id).strip() or None

    if not _SDK_AVAILABLE:
        yield sse_event("error", {"message": "claude_agent_sdk is not installed"})
        yield sse_event("done", {"stopped": False})
        return

    cancel_signal = ctx.request.signal
    store_adapter = ctx.store

    # Get Claude session store for transcript persistence (matches TS reference).
    # This gives the SDK multi-turn context, preventing chaotic/repeated tool calls.
    try:
        raw_session_store = store_adapter.claude_session_store()
        logger.log(f"[session_store] enabled, type={type(raw_session_store).__name__}, value={raw_session_store is not None}")
    except Exception as e:
        raw_session_store = None
        logger.error(f"[session_store] failed to get claude_session_store: {e}")
    session_store = raw_session_store

    # Save user message (with frontend-generated ID if available)
    if cid:
        # === DEBUG: dump all store messages for this conversation ===
        try:
            all_msgs = await store_adapter.get_messages(conversation_id=cid, limit=100, order="asc")
            logger.log(f"[debug_store] conversation={cid}, total_messages={len(all_msgs)}")
            for m in all_msgs:
                role = getattr(m, "role", "?")
                msg_id = getattr(m, "message_id", "?")
                content = getattr(m, "content", "")
                preview = str(content)[:200] if content else ""
                created_at = getattr(m, "created_at", 0)
                logger.log(f"[debug_store]   [{role}] id={msg_id} ts={created_at} content={preview}")
        except Exception as e:
            logger.error(f"[debug_store] failed to dump: {e}")
        # === END DEBUG ===

        try:
            # append_message accepts only: conversation_id, role, content, metadata, user_id.
            # message_id is not supported (the SDK auto-generates one).
            await store_adapter.append_message(
                conversation_id=cid,
                role="user",
                content=user_message,
                user_id=user_id,
            )
        except Exception as e:
            logger.error(f"[store] failed to save user message: {e}")

    # Build EdgeOne platform tools → Claude Agent SDK MCP server
    raw_tools = ctx.tools
    if not hasattr(raw_tools, "to_claude_mcp_server"):
        yield sse_event("error", {"message": "context.tools.to_claude_mcp_server is unavailable."})
        yield sse_event("done", {"stopped": False})
        return

    edgeone_mcp = raw_tools.to_claude_mcp_server(MCP_SERVER_NAME, {"always_load": True})
    logger.log("[tool_debug][mcp_server]", {
        "name": getattr(edgeone_mcp, "name", None),
        "allowed_tools": getattr(edgeone_mcp, "allowed_tools", None),
        "tools": [
            {
                "name": getattr(tool, "name", None) if not isinstance(tool, dict) else tool.get("name"),
                "description": getattr(tool, "description", None) if not isinstance(tool, dict) else tool.get("description"),
                "input_schema": getattr(tool, "input_schema", None) if not isinstance(tool, dict) else tool.get("input_schema"),
            }
            for tool in (getattr(edgeone_mcp, "tools", None) or [])
        ],
    })
    mcp_server = create_sdk_mcp_server(
        name=edgeone_mcp.name,
        tools=edgeone_mcp.tools,
    )

    sdk_session_id, sdk_resume = await resolve_claude_session_binding(session_store, cid)
    options = build_agent_options(
        session_store=session_store,
        mcp_server=mcp_server,
        mcp_server_name=edgeone_mcp.name,
        allowed_tools=edgeone_mcp.allowed_tools,
        session_id=sdk_session_id,
        resume=sdk_resume,
    )

    stopped = False
    stream_state = StreamState(bot_msg_id=bot_msg_id)

    try:
        response_iter = query(prompt=user_message, options=options).__aiter__()
        async for item_type, msg in iter_query_messages(response_iter, cancel_signal, HEARTBEAT_INTERVAL_S):
            if item_type == "cancelled":
                logger.log(f"[cancel] cancel_signal observed, stopping stream cid={cid!r}")
                stopped = True
                break
            if item_type == "finished":
                break
            if item_type == "ping":
                yield sse_event("ping", {"ts": int(time.time() * 1000)})
                continue

            events, should_stop = sdk_message_to_sse(msg, stream_state, logger)
            for event in events:
                yield event
            if should_stop:
                break

    except Exception as e:  # noqa: BLE001
        logger.error(f"[error] {e}")
        yield sse_event("error", {
            "message": str(e),
            "errorType": type(e).__name__,
            "detail": repr(e),
        })

    # Save assistant response (with frontend-generated ID if available)
    # Save even if text is empty but images were sent (use placeholder)
    assistant_content = sanitize_assistant_text(stream_state.full_assistant_text).strip()
    if not assistant_content and stream_state.has_images:
        assistant_content = "[image]"

    if store_adapter and cid and assistant_content:
        try:
            # append_message accepts only: conversation_id, role, content, metadata, user_id.
            await store_adapter.append_message(
                conversation_id=cid,
                role="assistant",
                content=assistant_content,
                user_id=user_id,
            )
        except Exception as e:
            logger.error(f"[store] failed to save assistant response: {e}")

    yield sse_event("done", {"stopped": stopped})
