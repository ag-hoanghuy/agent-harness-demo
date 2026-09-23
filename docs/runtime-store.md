# PostgreSQL Runtime Store

Part 03 bổ sung lớp persistence cho trạng thái runtime do Harness sở hữu. Lớp này chỉ lưu và đọc dữ liệu; nó không quyết định bước workflow tiếp theo và không phải Run Orchestrator.

```text
Harness Domain
     │
     ▼
Repository Interface
     │
     ▼
TypeORM Repository
     │
     ▼
PostgreSQL
```

## PostgreSQL là nguồn dữ liệu chuẩn

PostgreSQL là source of truth cho Harness Run runtime state, Checkpoint, Audit Event và bản ghi Tool Call. Trạng thái chỉ nằm trong RAM sẽ mất khi process khởi động lại và không thể hỗ trợ recovery hoặc phối hợp nhiều process một cách an toàn.

Redis và BullMQ chưa được sử dụng. Các tệp trong channel workspace chỉ chứa config, rules, skills và approved memory; chúng không phải nguồn dữ liệu chuẩn cho runtime state.

## Contract và Entity

Domain contract mô tả dữ liệu mà các lớp nghiệp vụ được phép sử dụng. Persistence entity mô tả cách dữ liệu được lưu bằng TypeORM, gồm kiểu cột, index và timestamp. Mapper chuyển đổi hai chiều giữa contract và entity, nhờ đó domain layer không phụ thuộc trực tiếp vào TypeORM Repository và không trả entity ra ngoài persistence layer.

## Optimistic concurrency

Mỗi Harness Run có cột `version`. Khi lưu thay đổi, repository chạy câu lệnh update với cả `id` và `expectedVersion`, đồng thời tăng `version` trong database. Nếu không có row nào được update, repository trả `RunNotFoundError` hoặc `RunVersionConflictError`; dữ liệu mới hơn không bị ghi đè âm thầm.

## Checkpoint append-only

Checkpoint được append để giữ ảnh chụp của Run tại một thời điểm. Repository chỉ cung cấp `append` và `findLatestByRunId`, không có phương thức update hoặc delete checkpoint cũ.

## Audit Event append-only

Audit Event lưu lịch sử hành động theo thứ tự thời gian. Repository chỉ cung cấp `append` và `findByRunId`, không có phương thức update hoặc delete lịch sử.

## Dữ liệu JSONB

PostgreSQL dùng JSONB cho:

- `run_checkpoints.artifact_refs`
- `audit_events.metadata`
- `tool_calls.input`
- `tool_calls.output`
- `tool_calls.error`

Các cột này chứa dữ liệu có cấu trúc linh hoạt nhưng vẫn nằm trong một record có định danh, schema version và audit context rõ ràng.

## State và Audit trong cùng transaction

```text
Transaction
├── UPDATE harness_runs
└── INSERT audit_events

COMMIT hoặc ROLLBACK cùng nhau
```

`RuntimeStoreService.saveRunWithAudit` chỉ là transaction boundary của persistence. Nếu optimistic update conflict thì Audit Event không được insert. Nếu insert Audit Event thất bại thì thay đổi Run state và version được rollback.

## Dữ liệu được persist trong Part 03

- Harness Run
- Checkpoint
- Audit Event
- Tool Call

Part 03 chưa persist Episode, Gate, Artifact hoặc Production State của Mini M2. Nó cũng chưa triển khai workflow execution, Channel Runtime, Agent Runtime, Tool Broker execution, MCP runtime, scheduler hoặc REST API quản lý Run.

## Migration

Migration `CreateHarnessRuntimeTables1790121600000` tạo bốn bảng runtime và toàn bộ index/foreign key cần thiết. `synchronize` luôn tắt; schema chỉ thay đổi thông qua migration đã được review.
