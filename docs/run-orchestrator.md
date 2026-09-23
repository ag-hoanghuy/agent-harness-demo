# Harness Run Orchestrator

Part 05 triển khai thành phần sở hữu lifecycle của `run_id`. Orchestrator thực hiện từng mutation rõ ràng, dùng state transition của Part 02, repository/transaction của Part 03 và ChannelContext của Part 04.

```text
Caller
  ↓
Harness Run Orchestrator
  ├── Channel Registry (qua Context Loader)
  ├── Context Loader
  ├── Policy
  └── Runtime Store
          ↓
      PostgreSQL
```

Orchestrator sở hữu việc tạo Run, chuyển state, kiểm tra policy/capacity, tạo preflight checkpoint và yêu cầu audit. Nó không sở hữu Episode, ProductionState, Gate, Artifact hoặc workflow sản xuất của Mini M2. Nó cũng không thực thi Agent, tool, MCP, scheduler hay REST API.

## Public API

- `createRun(command)` tạo Run mới ở `SCHEDULED`.
- `queueRun(command)` thực hiện đúng transition `SCHEDULED → QUEUED`.
- `preflightRun(command)` thực hiện preflight deterministic và chuẩn bị bước kế tiếp.

Mỗi command bắt buộc có actor và correlation ID. Mutation của Run hiện hữu còn bắt buộc `expectedVersion`; repository vẫn là chốt optimistic concurrency cuối cùng.

## Lifecycle của Part 05

```text
SCHEDULED
    ↓
QUEUED
    ↓
PREFLIGHT
    ↓
RUNNING_STEP
current_step=TOPIC_RESEARCH
    ↓
[Part 06]
```

`createRun` kiểm tra channel tồn tại, parse config và xác nhận channel đang enabled. Run ID được tạo bằng `crypto.randomUUID()`, `retry_count` bằng 0 và `max_retries` lấy từ `limits.max_retries_per_step`. Run và `RUN_CREATED` được insert trong cùng transaction.

`queueRun` load Run, kiểm tra expected version, tái sử dụng `assertRunTransition`, rồi commit state `QUEUED` cùng `RUN_STATE_CHANGED`. Nó không skip trực tiếp từ `SCHEDULED` sang `PREFLIGHT`.

## Preflight deterministic

Preflight không gọi mô hình AI. Nó thực hiện:

1. Chuyển `QUEUED → PREFLIGHT`, đặt `current_step=PRECHECK`, ghi `RUN_STATE_CHANGED` và `STEP_STARTED` atomically.
2. Load ChannelContext đúng channel với duy nhất skill `topic-research`.
3. Kiểm tra channel enabled, capacity, sự nhất quán của context và step kế tiếp.
4. Tạo context snapshot chỉ chứa metadata/checksum.
5. Trong một transaction, append checkpoint, chuyển Run thành `RUNNING_STEP / TOPIC_RESEARCH`, ghi `STEP_COMPLETED` và `RUN_STATE_CHANGED`.

Nếu transaction cuối lỗi, checkpoint, Run update và audit cuối đều rollback. Run vẫn ở `PREFLIGHT` với `STEP_STARTED`, thể hiện trung thực preflight đã bắt đầu nhưng chưa hoàn tất.

## Capacity

Các state chiếm `max_active_runs` là:

- `QUEUED`
- `PREFLIGHT`
- `RUNNING_STEP`
- `WAITING_GATE`
- `NEEDS_REVISION`
- `AWAITING_MANUAL_PUBLISH`
- `MEASURING`

Run đang được kiểm tra luôn bị loại khỏi tập cạnh tranh. `SCHEDULED` chưa nhận slot; `BLOCKED`, `PAUSED` và `FAILED_RECOVERABLE` nhả slot để không khóa channel vô thời hạn. Việc retry/resume phải kiểm tra lại capacity ở Part 11.

Part 05 chưa định nghĩa fairness cho nhiều Run cùng tranh slot và chưa dùng scheduler, advisory lock hoặc hàng đợi phân tán. Admission hiện an toàn theo hướng bảo thủ nhưng có thể block nhiều contender; chiến lược chọn Run tiếp theo vẫn là quyết định mở cho phần scheduler/recovery sau này.

## Mapping lỗi preflight

- Channel disabled hoặc hết capacity: chuyển `BLOCKED`, ghi `RUN_STATE_CHANGED`, sau đó trả typed error cho caller.
- Channel/config/context/skill/path không hợp lệ hoặc step không hợp lệ: chuyển `FAILED_FINAL`, ghi `RUN_STATE_CHANGED` và `RUN_FAILED`.
- Lỗi hạ tầng không được phân loại: chuyển `FAILED_RECOVERABLE`, ghi audit và trả `RunPreflightError` có `cause`.

Không tạo state mới. Transition thất bại và version conflict vẫn dùng rule/error hiện có.

## ChannelContext và checkpoint

Context Loader cung cấp rules, skill `topic-research`, approved memory và tool permission hiệu lực. Orchestrator không ghi lại nội dung Markdown. `createContextSnapshot` chỉ lấy channel ID, relative path/checksum của rules, skills, memory và `effectiveAllowedTools`.

Checkpoint dùng `step=PRECHECK`, `run_state=RUNNING_STEP`, `artifact_refs=[]` và context snapshot. `context_snapshot` là field tùy chọn, nên checkpoint cũ vẫn đọc được. Persistence dùng envelope trong cột JSONB hiện có và không thay đổi schema database.

## Transaction và audit

- Tạo Run: `INSERT harness_runs + INSERT RUN_CREATED`.
- Queue: `UPDATE harness_runs + INSERT RUN_STATE_CHANGED`.
- Bắt đầu preflight: `UPDATE harness_runs + INSERT RUN_STATE_CHANGED + INSERT STEP_STARTED`.
- Hoàn tất preflight: `INSERT checkpoint + UPDATE harness_runs + INSERT STEP_COMPLETED + INSERT RUN_STATE_CHANGED`.
- Preflight lỗi: state lỗi/block và audit tương ứng trong cùng transaction.

Audit của một command và checkpoint do command đó tạo dùng cùng correlation ID. Metadata chỉ chứa state, step và tên loại lỗi; không chứa secret hay nội dung channel knowledge.

## Điểm dừng và quyết định còn mở

`RUNNING_STEP / TOPIC_RESEARCH` nghĩa là Run đã sẵn sàng để Part 06 thực hiện nghiên cứu chủ đề. Part 05 không coi bước này đã chạy, không tạo Agent task và không gọi FakeProvider/Gemini.

Part 05 cũng không tạo Episode hay gọi Mini M2. Tích hợp production bắt đầu ở Part 09.

STOP semantics vẫn để mở vì `HarnessRunState` chưa có state `STOPPED`. Part 05 không ánh xạ `RUN_STOPPED` sang một state khác và không tự phát minh stop flow. Pause, resume và recovery đầy đủ vẫn thuộc Part 11.
