# Bản demo Agent Harness

## Mục tiêu

Kho mã này là dự án học tập, minh họa một Local Agent Harness dành cho một kênh nội dung. Phần 01 khởi tạo ứng dụng NestJS và ghi lại kiến trúc dự kiến, chưa triển khai môi trường thực thi hoặc logic nghiệp vụ.

## Nguyên tắc kiến trúc

- Harness kiểm soát việc thực thi quy trình, vòng đời runtime, chính sách và quyền hạn.
- Agent chỉ suy luận trong nhiệm vụ được giao; Agent không thay đổi trạng thái quy trình hoặc phê duyệt Gate.
- Mini M2 sở hữu quy trình sản xuất, Gate, Artifact và việc kiểm tra nghiệp vụ.
- Mọi truy cập công cụ sau này sẽ đi qua Tool Broker.
- PostgreSQL sẽ được bổ sung ở phần sau và đóng vai trò nguồn dữ liệu chuẩn cho trạng thái runtime.
- M1 và M4 hiện chưa được triển khai; các phần sau sẽ bắt đầu bằng bộ chuyển đổi (adapter) hoặc bản mô phỏng (mock).

Xem [Ranh giới kiến trúc](docs/architecture-boundaries.md) để hiểu rõ mô hình sở hữu.

## Tiến độ hiện tại

- [x] Phần 01 - Khởi tạo dự án và bộ khung kiến trúc
- [x] Phần 02 - Định nghĩa giao tiếp cốt lõi và mô hình trạng thái
- [ ] Phần 03 - Kho lưu trữ runtime bằng PostgreSQL
- [ ] Phần 04 - Runtime của kênh và bộ nạp ngữ cảnh
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

## Chạy trên máy cục bộ

Yêu cầu: Node.js 22 trở lên và npm.

```bash
npm install
npm run start:dev
```

Ứng dụng mặc định lắng nghe tại cổng `3000`. Có thể thay đổi bằng biến môi trường `APP_PORT`. Cấu hình mẫu được ghi trong `.env.example`; Phần 01 chưa tự động nạp tệp `.env`.

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
npm run build
```
