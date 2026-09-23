# Ranh giới kiến trúc

Phần 01 chỉ thiết lập ranh giới sở hữu. Phần này chưa triển khai cơ chế điều phối, tích hợp, lưu trữ bền vững hoặc quy trình nghiệp vụ.

```text
Người vận hành
   ↓
Harness
   ↓
Runtime của kênh
   ├── Agent
   │    ↓
   │ Tool Broker
   │    ↓
   │   MCP
   │
   └── Mini M2
```

## Harness sở hữu

- `run_id`
- Vòng đời của run
- Policy
- Các thao tác tạm dừng, tiếp tục và dừng
- Cơ chế retry
- Checkpoint
- Quyền sử dụng công cụ
- Bản ghi audit

Harness Run Orchestrator điều phối các run của Harness. Thành phần này không phải là Mini M2 Production Orchestrator.

## Mini M2 sở hữu

- `episode_id`
- Quy trình và trạng thái sản xuất
- Gate
- Artifact
- Việc kiểm tra nghiệp vụ

Mini M2 không sở hữu vòng đời run của Harness hoặc quyền hạn runtime.

## Ranh giới của Agent

Agent chỉ thực hiện suy luận trong nhiệm vụ được giao. Agent không trực tiếp thay đổi trạng thái quy trình, phê duyệt Gate, truy cập cơ sở dữ liệu hoặc kho lưu trữ, chạy lệnh shell tùy ý hay gọi tiến trình worker.

## Ranh giới của MCP

MCP là một giao thức tích hợp. MCP không phải Agent và cũng không phải Harness. Các tích hợp công cụ sau này sẽ được kiểm soát thông qua Tool Broker.

## Ranh giới của M1 và M4

M1 và M4 chưa được triển khai trong Phần 01. Các phần sau sẽ bắt đầu bằng bộ chuyển đổi (adapter) hoặc bản mô phỏng (mock) trước khi bổ sung tích hợp thật.

## Nguồn dữ liệu chuẩn của runtime

Từ Phần 03, PostgreSQL là source of truth cho Harness Run runtime state, Checkpoint, Audit Event và bản ghi Tool Call. Redis và BullMQ chưa được sử dụng.

Channel workspace không lưu runtime state. Các tệp trong channel chỉ cung cấp config, rules, skills và approved memory.

Persistence entity là chi tiết của adapter TypeORM và không thay thế domain contract. Episode, Gate, Artifact và Production State của Mini M2 chưa được persist trong Phần 03.

## Channel knowledge chỉ đọc

Từ Phần 04, Channel Registry và Context Loader đọc knowledge đã được duyệt trong đúng một channel workspace. Loader không ghi lại `channel.yaml`, rules, skills hoặc approved memory; cũng không tạo Run, chuyển state hay gọi Agent và Tool Broker.

Mỗi đường dẫn được suy ra từ thư mục gốc `channels/` và identifier đã kiểm tra. Một channel không được đọc knowledge của channel khác. PostgreSQL tiếp tục là nguồn dữ liệu chuẩn cho runtime state, còn filesystem của channel là nguồn cấu hình và knowledge đã được duyệt.
