# Local MCP Tools

Part 08 nối Tool Broker với một MCP server cục bộ, deterministic. MCP trong demo này là giao thức để gọi capability; nó không phải Agent, không sở hữu workflow và không phải authorization boundary.

```text
Agent
  ↓
Tool request
  ↓
Tool Broker
  ↓
Tool Registry
  ↓
McpToolExecutor
  ↓
MCP Client
  ↓ stdio
Local MCP Server
  ↓
Mock Media / Analytics
```

Agent không gọi MCP trực tiếp, không giữ MCP client và không biết command, process path hoặc working directory của server. Trusted application code luôn gọi `ToolBrokerService.execute`; Broker kiểm tra scope, Run state, allowlist, schema, timeout và retry trước khi MCP được phép chạy.

## MCP khác Tool Broker như thế nào

MCP chuẩn hóa cách client khám phá và gọi tool. Tool Broker quyết định request có được phép chạy trong Harness hay không, persist `ToolCall`, ghi audit, enforce timeout/retry/idempotency và giữ ranh giới trusted scope.

```text
MCP Server nói:
"Tôi có search_assets"

không có nghĩa:
"Agent được phép dùng search_assets"
```

`listTools` chỉ là discovery. Authorization vẫn là giao của:

```text
AgentTask.allowed_tools
          ∩
ChannelContext.effectiveAllowedTools
```

Ví dụ, Local MCP Server advertise `get_asset_metadata`, nhưng skill `topic-research` hiện không cấp tool đó. Request tương ứng bị Tool Broker ghi `DENIED` trước khi `McpClientService.callTool` được gọi.

## SDK và transport

Implementation dùng official `@modelcontextprotocol/sdk` 1.30.1 và Zod 4. Local MCP Server dùng `StdioServerTransport`; client dùng `StdioClientTransport`. Protocol JSON-RPC đi qua stdin/stdout của child process.

Lệnh sau chạy server độc lập:

```bash
npm run mcp:local
```

Stdout chỉ dành cho MCP protocol. Thông báo khởi động và lỗi được ghi qua stderr. Ứng dụng dùng `process.execPath` cùng entrypoint do application resolve tại runtime; Agent không thể truyền command, args, binary path hoặc working directory. Không có đường dẫn Windows tuyệt đối được hardcode.

## Local MCP Server

Server nằm trong `src/mcp/local/`. `createLocalMcpServer` đăng ký đúng ba tool allowlisted, còn entrypoint `local-mcp-server.ts` nối server với stdio. Server không import repository, `RuntimeStoreService`, audit service hoặc Harness Run contract; nó chỉ đọc mock data trong cùng module.

Server không gọi network, shell, arbitrary filesystem, database ngoài, S3 hoặc URL do caller cung cấp.

## Ba local tools

### `search_assets`

Input có `query` bắt buộc và `limit` tùy chọn từ 1 đến 20. Tool tìm kiếm deterministic trên title, location và tags đã normalize, sau đó trả `{ assets: [...] }` có cấu trúc. Không dùng semantic search, embedding hoặc pgvector.

### `get_asset_metadata`

Input là `{ asset_id }`. Tool trả metadata của asset đã có trong catalog. ID không tồn tại trả MCP tool error `ASSET_NOT_FOUND`; server không tự phát minh asset mới.

### `get_recent_analytics`

Input gồm `channel_id` và `days`. Tool trả `channel_id`, `period_days`, `metrics` và `top_topics` deterministic cho demo channel. Channel không có mock data trả `ANALYTICS_NOT_FOUND`.

Cả ba tool đều read-only:

- `idempotent=true`;
- `side_effect=false`;
- không thay đổi Harness Run, checkpoint, Gate hoặc production state.

## Mock M1 data

`mock-media-catalog.ts` chứa năm asset nhỏ về Cái Răng, Hội An, Hà Giang, Hà Nội và Hạ Long. `mock-analytics.ts` chứa views, average watch time và top topics của demo channel.

Đây chỉ là **MOCK M1 DATA**. M1 thật chưa tồn tại; Part 08 mô phỏng capability mà adapter M1 sau này có thể cung cấp. Tool Broker không chứa hoặc biết business data này.

## Nguồn schema duy nhất

`local-tool-definitions.ts` định nghĩa Zod schema cho input/output. MCP Server dùng trực tiếp các schema đó để advertise và validate protocol call. Cùng schema được chuyển deterministic sang JSON Schema draft-07 cho `ToolDefinition`, để AJV của Tool Broker validate cùng semantic contract.

Part 08 không copy độc lập ba bộ schema giữa server, executor và Broker. Unit/integration test tiếp tục kiểm tra cả registration lẫn structured output.

## McpClientService

Client tạo một kết nối lazy ở lần `connect`, `listTools` hoặc `callTool` đầu tiên và tái sử dụng kết nối đó. Nhiều lần gọi không spawn lại server nếu connection còn khỏe.

Khi Nest module shutdown, `onModuleDestroy` gọi `close`; MCP SDK đóng client/stdio transport và child process. Nếu transport hỏng, service bỏ connection cũ để lần retry tiếp theo do Broker quyết định có thể tạo connection mới.

Client không chứa authorization, Run state, persistence hoặc Harness retry policy.

## McpToolExecutor

Mỗi executor được bind sẵn với đúng một MCP tool name:

```text
search_assets        → McpToolExecutor("search_assets")
get_asset_metadata   → McpToolExecutor("get_asset_metadata")
get_recent_analytics → McpToolExecutor("get_recent_analytics")
```

Agent chỉ cung cấp structured input; Agent không thể chọn MCP method tùy ý. Executor gọi `McpClientService.callTool`, ưu tiên `structuredContent`, và chỉ fallback sang đúng một JSON text block có object root. MCP `content[]`, `_meta` và protocol object không thoát lên Tool Broker hoặc Agent.

## Error mapping

- Không kết nối được: `MCP_CONNECTION_ERROR`, retryable.
- Transport bị ngắt/hủy: `MCP_TRANSPORT_ERROR`, retryable.
- Tool trả `isError`: `MCP_TOOL_ERROR`, mặc định không retryable.
- Response không có structured object hợp lệ: `MCP_INVALID_RESPONSE`, không retryable.

ToolCall chỉ nhận code/message đã normalize; stack trace nội bộ và raw protocol response không được persist làm output.

## Timeout và retry ownership

Timeout chính vẫn thuộc Tool Broker qua `ToolDefinition.timeout_ms`. Broker truyền `AbortSignal` xuống `McpToolExecutor`, rồi client chuyển signal vào MCP SDK để dừng chờ/cancel request khi có thể. Adapter không đặt một timeout nghiệp vụ riêng.

MCP client/executor không có retry loop. Nó chỉ ném lỗi có `retryable`; Tool Broker quyết định retry dựa trên `retryable`, `idempotent` và `max_retries`. Vì vậy không xảy ra retry nhân đôi giữa Broker và MCP.

## Tool registration

`McpToolRegistrationService` chạy deterministic khi module khởi tạo. Service đăng ký ba cặp `ToolDefinition + McpToolExecutor` vào `ToolRegistryService`. Duplicate vẫn bị Part 07 từ chối; production module không đăng ký fake executor.

`McpModule` phụ thuộc `ToolBrokerModule`, còn Tool Broker chỉ biết abstraction `ToolExecutor` và không import MCP. Dependency direction này giữ đúng dependency inversion.

## Persistence và Run state

MCP Server không truy cập Harness database. Tool Broker vẫn persist ToolCall/audit qua Runtime Store. Sau MCP success hoặc failure, Harness Run giữ nguyên state, step và version:

```text
RUNNING_STEP / TOPIC_RESEARCH
```

Tool success không đồng nghĩa workflow step success.

## Security boundary

Part 08 không có arbitrary command execution, shell tool, arbitrary path/URL, credential forwarding hoặc database access từ Agent. Server chỉ expose ba tool cố định. Launch command do application xác định, dùng Node APIs cross-platform và không nhận dữ liệu process từ tool request.

`required_permissions` được khai báo trong definition để mô tả capability, nhưng permission claims đáng tin cậy vẫn là quyết định mở từ Part 07. Authorization hiện được enforce bằng task/context allowlist.

## Giới hạn Part 08

Part 08 chưa có Agent tool-calling loop, Gemini/OpenAI/Claude, real M1, real analytics, media processing, FFmpeg, OCR, object storage, Mini M2, Gate hoặc production workflow transition. Part 08 cũng không thêm database migration.
