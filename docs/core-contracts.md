# Contract cốt lõi và mô hình trạng thái

Phần 02 định nghĩa ngôn ngữ chung giữa các thành phần bằng TypeScript. Các contract chỉ mô tả dữ liệu và quy tắc hợp lệ; chúng chưa thực thi workflow và chưa được lưu vào cơ sở dữ liệu.

```text
Harness Run
   │
   ├── run_id
   ├── HarnessRunState
   └── RunStep
          │
          ▼
     Mini M2
          │
          ├── episode_id
          ├── ProductionState
          ├── Gate
          └── Artifact
```

## RunId và EpisodeId

`RunId` định danh một lần thực thi do Harness sở hữu. `EpisodeId` định danh một đơn vị sản xuất do Mini M2 sở hữu. Một episode có thể được xử lý qua nhiều run vì retry, khôi phục hoặc thao tác vận hành, nên hai ID không thể thay thế cho nhau. Branded type giúp TypeScript phát hiện việc truyền nhầm ID khi biên dịch.

## HarnessRunState và ProductionState

`HarnessRunState` mô tả vòng đời thực thi: xếp hàng, preflight, chạy bước, chờ Gate, tạm dừng, lỗi và hoàn tất. `ProductionState` mô tả tiến độ nghiệp vụ của nội dung: nghiên cứu chủ đề, creative brief, timeline, render, thumbnail, package phát hành và đo lường.

Hai state model là hai enum riêng. Harness Run Orchestrator không phải Mini M2 Production Orchestrator.

## State do Harness sở hữu

Harness sở hữu toàn bộ `HarnessRunState`, `RunStep`, retry, pause/resume/stop, checkpoint, quyền công cụ và audit. Transition map chỉ biểu diễn quy tắc được phép; Part 02 chưa có service tự chuyển state.

## State do Mini M2 sở hữu

Mini M2 sở hữu toàn bộ `ProductionState`, Gate, Artifact và kiểm tra nghiệp vụ. Transition production tách biệt hoàn toàn khỏi transition của Harness.

## Gate contract

Gate ghi nhận loại điểm kiểm duyệt, trạng thái, hành động cần thực hiện, các Artifact ứng viên và quyết định của người vận hành. Invariant bắt buộc Gate được phê duyệt phải có `decided_by`, Gate bị từ chối phải có `feedback`, và Gate đang chờ không được có `decided_at`.

## Tool contract

`ToolDefinition` mô tả quyền cần thiết, timeout, retry, tính idempotent và khả năng tạo side effect. Từ Part 07, contract `tool-definition-1.1` bổ sung JSON Schema cho input/output để Tool Broker validate trước và sau execution. `ToolCall` ghi nhận một yêu cầu gọi công cụ cùng input, output hoặc lỗi.

Part 08 tái sử dụng nguyên contract này cho ba local MCP tool. MCP protocol object không trở thành domain contract mới: `McpToolExecutor` normalize kết quả về plain structured object trước khi trả cho Tool Broker.

## Checkpoint

Checkpoint là ảnh chụp dữ liệu của run tại một bước, gồm state, tham chiếu Artifact và correlation ID. Từ Phần 05, checkpoint có thể kèm `context_snapshot` tùy chọn chứa checksum metadata của ChannelContext. Field tùy chọn giữ tương thích với checkpoint cũ và không chứa toàn bộ nội dung Markdown.

## Audit event

Audit event mô tả sự kiện đã xảy ra, actor, correlation ID và metadata. Part 02 chưa có audit logger hoặc persistence.

## Agent contract

`AgentTask` giới hạn nhiệm vụ, công cụ và ngữ cảnh được cấp cho Agent. `AgentResult` chỉ chứa kết quả có cấu trúc, tham chiếu bằng chứng và cảnh báo; contract không lưu chain-of-thought hoặc suy luận nội bộ.

## Schema version

`schema_version` giúp bên tạo và bên đọc dữ liệu nhận biết phiên bản contract, từ đó hỗ trợ kiểm tra tương thích và nâng cấp dữ liệu trong tương lai. Part 02 chỉ khai báo hằng số phiên bản, chưa sinh JSON Schema.

## Giới hạn của Part 02

Part 02 chỉ định nghĩa contract, state model, transition map và invariant thuần. Chưa có orchestration runtime, persistence, database, MCP runtime, Gemini, scheduler hoặc API quản lý run.
