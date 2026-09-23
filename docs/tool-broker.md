# Tool Broker

Part 07 bổ sung lớp thực thi công cụ có kiểm soát cho Harness. Agent chỉ suy luận và tạo yêu cầu logic; Agent không nhận executor, kết nối database, credential, shell, filesystem, HTTP client hoặc MCP client.

```text
AgentTask
   ↓
Tool Request
   ↓
Tool Broker
   ├── Scope Check
   ├── Authorization
   ├── Schema Validation
   ├── Timeout / Retry
   ├── Persistence
   └── Audit
          ↓
     Tool Registry
          ↓
     Tool Executor
          ↓
       Tool Result
```

Tool Broker là boundary duy nhất quyết định một tool request có được phép chạy hay không. Public API nhận `HarnessRun`, `AgentTask`, `ChannelContext` và `ToolExecutionRequest`; caller không được truyền cờ `allowed=true` hoặc executor tùy ý.

## ToolExecutionRequest và trusted scope

Request chỉ gồm `toolName`, structured `input`, `actor` và `correlationId`. Part 07 không có contract nhận shell command, raw filesystem path hoặc arbitrary URL execution.

Trước khi persist hoặc execute, Broker bắt buộc kiểm tra:

- `run.id === agentTask.run_id`;
- `run.channel_id === agentTask.channel_id`;
- `run.channel_id === channelContext.channel.channelId`;
- Run đang ở `HarnessRunState.RUNNING_STEP`.

Scope sai tạo `ToolScopeMismatchError`; state sai tạo `ToolRunStateError`. Hai trường hợp này không tạo ToolCall và không gọi executor. Broker không thay đổi Run state hoặc version.

## Tool Registry

`ToolRegistryService` là runtime configuration trong bộ nhớ. Trusted bootstrap code hoặc test gọi `register` với một `RegisteredTool`, gồm `ToolDefinition` và `ToolExecutor`. Registry kiểm tra definition, compile schema, chống duplicate name và resolve implementation theo tên logic như `search_assets`.

Agent không cung cấp executor. Tool chưa đăng ký bị Broker persist thành `DENIED` với code `TOOL_NOT_REGISTERED`.

## ToolDefinition và JSON Schema

Part 07 nâng `ToolDefinition` lên schema `tool-definition-1.1` bằng cách bổ sung `input_schema` và `output_schema`. AJV thực hiện JSON Schema validation; project không tự cài đặt JSON Schema engine.

Definition tiếp tục mô tả `required_permissions`, `timeout_ms`, `max_retries`, `idempotent` và `side_effect`. `required_permissions` được giữ cho capability model sau này, nhưng Part 07 chưa có nguồn permission claims đáng tin cậy nên không tự phát minh permission system mới.

## ToolExecutor

`ToolExecutor` là abstraction độc lập transport:

```ts
execute(
  input: unknown,
  context: ToolExecutorContext,
  signal?: AbortSignal,
): Promise<unknown>;
```

Context chỉ chứa ToolCall ID, Run ID, Channel ID và correlation ID. Nó không chứa repository, database connection, NestJS container hoặc credential.

```text
Part 07:

Tool Executor
    ↓
Test Fake Executor

Part 08:

Tool Executor
    ↓
MCP Adapter
    ↓
MCP Server
```

Part 07 chỉ dùng test double deterministic. Từ Part 08, production module đăng ký ba `McpToolExecutor` read-only; Broker vẫn chỉ phụ thuộc abstraction và không biết MCP transport hay mock business data.

## Authorization

Tool chỉ được phép khi tên requested xuất hiện đồng thời trong:

```text
AgentTask.allowed_tools
          ∩
ChannelContext.effectiveAllowedTools
```

Thiếu ở một trong hai allowlist tạo ToolCall `DENIED`, audit `TOOL_DENIED` và không gọi executor. Broker không dùng trực tiếp `channel.allowedTools`, vì effective allowlist đã là giao giữa channel và selected skills.

## Input và output validation

Sau khi registry resolve và authorization thành công, input được validate với `input_schema`. Input sai chuyển `REQUESTED → DENIED`, lưu code `INVALID_TOOL_INPUT` và không chạy executor.

Output chỉ được chấp nhận sau khi validate với `output_schema`. Output sai chuyển `RUNNING → FAILED`, lưu code `INVALID_TOOL_OUTPUT`, ghi `TOOL_COMPLETED` với `final_status=FAILED` và không đưa output sai về Agent.

Validation error chỉ ghi schema path/keyword, không ghi toàn bộ payload vào audit.

## ToolCall lifecycle

```text
REQUESTED
  ├──→ DENIED
  └──→ ALLOWED
          ↓
       RUNNING
        ├──→ SUCCEEDED
        └──→ FAILED
```

`DENIED`, `SUCCEEDED` và `FAILED` là terminal. `tool-call-transition.ts` cung cấp `canTransitionToolCall` và `assertToolCallTransition`; Broker không gán status tùy ý.

## PostgreSQL persistence và audit

Mỗi bước lifecycle được persist vào bảng `tool_calls`. Các sự kiện tương ứng là:

- `REQUESTED` → `TOOL_REQUESTED`;
- `ALLOWED` → `TOOL_ALLOWED`;
- `DENIED` → `TOOL_DENIED`;
- `SUCCEEDED` hoặc `FAILED` → `TOOL_COMPLETED`.

`RuntimeStoreService` tạo/cập nhật ToolCall cùng Audit Event trong một transaction PostgreSQL. Nếu audit insert thất bại thì ToolCall insert/update rollback. Audit metadata chỉ chứa tool name, ToolCall ID, final status, error code, attempt count và cờ side effect; không chứa input/output đầy đủ, secret hoặc chain-of-thought.

Transition sang `RUNNING` không có audit event riêng trong contract hiện tại, nhưng vẫn được persist qua Runtime Store transaction.

## Timeout

Broker enforce `ToolDefinition.timeout_ms` bằng `Promise.race` và `AbortController`. Khi hết hạn, Broker abort signal, tạo lỗi `TOOL_TIMEOUT` và kết thúc việc chờ. Executor thật ở Part 08 phải tôn trọng `AbortSignal` để hủy underlying operation; nếu bỏ qua signal, Broker ngừng chờ nhưng không thể tự bảo đảm remote operation đã bị hủy.

## Retry và side effect

`max_retries` là số lần thử lại sau lần gọi đầu tiên. Broker chỉ tự retry khi đồng thời:

- executor trả lỗi có `retryable=true`;
- definition có `idempotent=true`;
- chưa dùng hết `max_retries`.

Tool không idempotent không được auto retry, kể cả lỗi retryable. Tool `side_effect=true` chỉ có thể retry khi definition đồng thời cam kết `idempotent=true`; Part 07 chưa thêm Human Gate cho side effect.

Toàn bộ bounded retry xảy ra khi ToolCall đang `RUNNING`. Khi đã `FAILED`, ToolCall là terminal và cùng invocation key sẽ trả record hiện hữu thay vì mở lại lifecycle.

## Idempotency

Một tool invocation được định danh bằng:

```text
(run_id, tool_name, correlation_id)
```

Migration Part 07 tạo unique index cho bộ ba này. Broker tra PostgreSQL trước khi tạo request; nếu đã có ToolCall thì trả record hiện hữu và không execute lại. Unique index xử lý race giữa nhiều process, nên in-memory registry/cache không phải source of truth cho idempotency.

`correlationId` ở đây là ID của một tool invocation, không nhất thiết là correlation ID của command quản lý toàn Run. Hai lần `search_assets` độc lập phải dùng hai ID mới; retry hoặc duplicate delivery của cùng invocation phải dùng lại ID cũ.

Giới hạn hiện tại: Broker trả ngay ToolCall `REQUESTED`, `ALLOWED` hoặc `RUNNING` nếu một duplicate tới trong lúc invocation đầu còn xử lý; Part 07 chưa có distributed waiting/recovery. Với `FAILED`, retry budget đã được dùng trong invocation gốc; muốn tạo một invocation mới, caller phải dùng correlation ID mới. Recovery xuyên process thuộc phần recovery sau này.

## Tích hợp Local MCP từ Part 08

Part 08 không thay đổi public API hoặc authorization flow của Broker. `McpToolRegistrationService` đưa `ToolDefinition + McpToolExecutor` vào registry; executor gọi Local MCP Server qua stdio sau khi Broker đã cho phép. MCP error được normalize thành `ToolExecutionError`, còn timeout/retry tiếp tục do Broker sở hữu.

MCP server advertise tool không có nghĩa Agent được phép dùng tool. `AgentTask.allowed_tools ∩ ChannelContext.effectiveAllowedTools` vẫn là điều kiện bắt buộc trước execution. Xem [Local MCP Tools](local-mcp-tools.md).

## Ranh giới Part 07

Tool Broker không gọi network, shell, filesystem hoặc real external tool trực tiếp; không nối tool-calling loop vào FakeProvider; không tạo Mini M2, Gate hoặc workflow transition. MCP của Part 08 chỉ xuất hiện sau abstraction `ToolExecutor`. Broker vẫn chỉ trả ToolCall có cấu trúc và giữ Run nguyên trạng `RUNNING_STEP / TOPIC_RESEARCH`.
