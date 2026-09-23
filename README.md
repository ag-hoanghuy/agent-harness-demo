# Bản demo Agent Harness

## Mục tiêu

Kho mã này là dự án học tập, minh họa một Local Agent Harness dành cho một kênh nội dung. Phần 01 khởi tạo ứng dụng NestJS và ghi lại kiến trúc dự kiến, chưa triển khai môi trường thực thi hoặc logic nghiệp vụ.

## Nguyên tắc kiến trúc

- Harness kiểm soát việc thực thi quy trình, vòng đời runtime, chính sách và quyền hạn.
- Agent chỉ suy luận trong nhiệm vụ được giao; Agent không thay đổi trạng thái quy trình hoặc phê duyệt Gate.
- Mini M2 sở hữu quy trình sản xuất, Gate, Artifact và việc kiểm tra nghiệp vụ.
- Mọi truy cập công cụ sau này sẽ đi qua Tool Broker.
- PostgreSQL là nguồn dữ liệu chuẩn cho trạng thái runtime do Harness sở hữu.
- M1 và M4 hiện chưa được triển khai; các phần sau sẽ bắt đầu bằng bộ chuyển đổi (adapter) hoặc bản mô phỏng (mock).

Xem [Ranh giới kiến trúc](docs/architecture-boundaries.md) để hiểu rõ mô hình sở hữu.

## Tiến độ hiện tại

- [x] Phần 01 - Khởi tạo dự án và bộ khung kiến trúc
- [x] Phần 02 - Định nghĩa giao tiếp cốt lõi và mô hình trạng thái
- [x] Phần 03 - Kho lưu trữ runtime bằng PostgreSQL
- [x] Phần 04 - Runtime của kênh và bộ nạp ngữ cảnh
- [ ] Phần 05 - Harness Run Orchestrator
- [ ] Phần 06 - Giao diện Agent Provider và FakeProvider
- [ ] Phần 07 - Tool Broker
- [ ] Phần 08 - Công cụ MCP cục bộ
- [ ] Phần 09 - Mini M2 và Gate 1
- [ ] Phần 10 - Gemini Provider
- [ ] Phần 11 - Checkpoint, tạm dừng, tiếp tục và khôi phục
- [ ] Phần 12 - Demo đầu-cuối

## Phạm vi Phần 02

Phần 02 chỉ bổ sung các contract và mô hình trạng thái. Chưa triển khai cơ chế điều phối runtime hoặc persistence. Xem [Contract cốt lõi](docs/core-contracts.md) để biết chi tiết.

## Phạm vi Phần 03

Phần 03 persist trạng thái runtime của Harness nhưng không thực thi workflow. PostgreSQL hiện lưu Harness Run, Checkpoint, Audit Event và Tool Call. Xem [PostgreSQL Runtime Store](docs/runtime-store.md) để biết chi tiết.

## Phạm vi Phần 04

Phần 04 nạp cấu hình channel, rules, các skill được chọn và approved memory thành một `ChannelContext` chỉ đọc. Chưa có workflow execution hoặc lời gọi AI. Xem [Channel Runtime và Context Loader](docs/channel-runtime.md) để biết chi tiết.

## Chạy trên máy cục bộ

Yêu cầu: Node.js 22 trở lên, npm và Docker.

```bash
npm install
docker compose up -d
npm run db:migration:run
npm run start:dev
```

Tạo hoặc cập nhật `.env` từ các biến trong `.env.example` trước khi chạy migration. Không commit tệp `.env` thật. PostgreSQL mặc định dùng `localhost:5432`; có thể đổi `POSTGRES_PORT` nếu cổng này đang được một PostgreSQL khác sử dụng.

Ứng dụng mặc định lắng nghe tại cổng `3000`. Có thể thay đổi bằng biến môi trường `APP_PORT`. Database module nạp biến môi trường từ `.env`, không hardcode credential trong code. TypeORM luôn chạy với `synchronize: false`.

Các lệnh database:

```bash
npm run db:migration:show
npm run db:migration:run
npm run db:migration:revert
npm run test:integration
```

Gửi yêu cầu `GET http://localhost:3000/` để nhận kết quả:

```json
{
  "name": "agent-harness-demo",
  "status": "ok",
  "phase": "part-01"
}
```

## Kiểm tra dự án

```bash
npm run lint
npm test
npm run test:e2e
npm run test:integration
npm run build
```
