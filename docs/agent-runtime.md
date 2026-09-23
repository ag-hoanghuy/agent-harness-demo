# Agent Runtime và FakeProvider

Part 06 bổ sung ranh giới thực thi Agent cho Harness. Thành phần này nhận một `HarnessRun` đã ở đúng điểm dừng của Part 05 cùng `ChannelContext`, tạo yêu cầu có cấu trúc, gọi provider và trả kết quả đã được kiểm tra cho caller.

```text
Harness Run
RUNNING_STEP / TOPIC_RESEARCH
       ↓
ChannelContext
       ↓
AgentRuntime
       ↓
AgentTask
       ↓
LLMProvider
       ↓
FakeProvider
       ↓
AgentResult
```

Agent Runtime không sở hữu lifecycle của Run. Nó không ghi PostgreSQL, không tạo checkpoint hoặc audit event, không chuyển sang step tiếp theo và không gọi Mini M2. Sau khi `execute` trả về, Run vẫn ở `RUNNING_STEP / TOPIC_RESEARCH`.

## Provider interface

`LlmProvider` là abstraction độc lập vendor với metadata tối thiểu `name` và method `execute(task, context)`. `AgentRuntimeService` chỉ inject token `LLM_PROVIDER`, vì vậy business logic không phụ thuộc `FakeProvider`, Gemini SDK hay kiểu dữ liệu riêng của một nhà cung cấp.

```text
LLMProvider
├── FakeProvider       ← Part 06
└── GeminiProvider     ← Part 10
```

Ở Part 10, module có thể bind `LLM_PROVIDER` sang `GeminiProvider` thay vì `FakeProvider` mà không sửa luồng của Agent Runtime. Part 06 không cài SDK và không gọi API AI thật.

## AgentTask

`AgentTask` là yêu cầu có cấu trúc được tạo mới cho mỗi lần execute. Với `TOPIC_RESEARCH`, task gồm:

- `task_id` sinh bằng `crypto.randomUUID()`;
- `run_id`, `episode_id` nếu có và `channel_id` lấy từ Run;
- `task_type=TOPIC_RESEARCH`;
- `allowed_tools` sao chép từ `ChannelContext.effectiveAllowedTools`;
- `context_refs` là logical reference như `channel-rule:editorial`, `skill:topic-research` và `memory:approved-knowledge`;
- `schema_version=agent-task-1.0`.

`context_refs` không chứa nội dung suy luận nội bộ hoặc chain-of-thought.

## AgentExecutionContext

Provider chỉ nhận ngữ cảnh tối thiểu, có cấu trúc và chỉ đọc:

- `channelId`, `runId`, `episodeId` nếu có;
- `taskType` và `correlationId`;
- nội dung `channelRules`, `selectedSkills` và `approvedMemory` đã được Context Loader nạp;
- `effectiveAllowedTools`.

Mỗi document chỉ mang tên logic và content. Context không chứa repository, NestJS service, credential, đường dẫn filesystem hoặc toàn bộ application state. Các mảng và object được Agent Runtime sao chép rồi freeze trước khi giao cho provider.

## FakeProvider

`FakeProvider` là provider deterministic để unit test và integration test không cần API key. Với cùng `AgentTask` và `AgentExecutionContext`, provider trả cùng một payload mô phỏng:

```json
{
  "status": "SUCCESS",
  "result": {
    "topic": "Chợ nổi Cái Răng lúc bình minh",
    "summary": "Dữ liệu mô phỏng ...",
    "candidate_asset_queries": [
      "can-tho river morning",
      "floating market vietnam"
    ]
  },
  "evidence_refs": ["mock:channel-rule:editorial", "mock:approved-memory"],
  "warnings": [],
  "schema_version": "agent-result-1.0"
}
```

`task_id` trong kết quả được giữ nguyên từ request. Đây hoàn toàn là dữ liệu mock, không phải analytics hoặc bằng chứng thực. FakeProvider không đọc fixture, filesystem, database và không gọi tool.

## AgentResult và structured output

Agent Runtime không chấp nhận raw string làm kết quả chính. Pure validator kiểm tra:

- kết quả là object và `task_id` khớp request;
- `status` thuộc enum `AgentResultStatus`;
- `schema_version` là `agent-result-1.0`;
- `evidence_refs` và `warnings` là mảng chuỗi;
- `result` tồn tại dưới dạng object theo contract hiện tại;
- riêng `TOPIC_RESEARCH` phải có `topic`, `summary` và `candidate_asset_queries` đúng kiểu.

Structured output giúp caller kiểm tra contract, version và dữ liệu task-specific trước khi sử dụng. `AgentResult` chỉ giữ kết quả, evidence reference và warning; không lưu chain-of-thought vì suy luận nội bộ không phải artifact nghiệp vụ, không cần cho orchestration và không nên được persist hoặc audit.

## Allowed tools nhưng chưa tool calling

`AgentTask.allowed_tools` luôn lấy từ `ChannelContext.effectiveAllowedTools`, tức giao của allowlist channel và các tool do skill được chọn khai báo. Agent Runtime không lấy trực tiếp từ `channel.allowedTools`.

Trong Part 06, allowlist này chỉ là metadata ràng buộc cho provider. Không có tool request protocol, Tool Broker execution hay MCP call. Tool Broker thuộc Part 07 và MCP runtime thuộc Part 08.

## Giới hạn Part 06

Agent Runtime chỉ hỗ trợ `HarnessRunState.RUNNING_STEP`, `RunStep.TOPIC_RESEARCH` và `AgentTaskType.TOPIC_RESEARCH`. State khác bị từ chối bằng `AgentRunStateError`; step không khớp bằng `AgentStepMismatchError`; task chưa hỗ trợ bằng `UnsupportedAgentTaskError`. Context thuộc channel khác cũng bị từ chối trước khi provider được gọi.

Kết quả chỉ được trả về caller trong bộ nhớ. Part 06 không persist Agent result, không retry orchestration, không tạo Gate, không ghi `ProductionState`, không render, không scheduler và không tự chuyển Run sang `CREATIVE_BRIEF`.
