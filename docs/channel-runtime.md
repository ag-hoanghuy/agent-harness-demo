# Channel Runtime và Context Loader

Part 04 tạo lớp đọc channel workspace và đóng gói dữ liệu thành một `ChannelContext` có cấu trúc. Lớp này chuẩn bị ngữ cảnh cho Run Orchestrator, Agent Runtime và Tool Broker ở các part sau; hiện tại nó không gọi bất kỳ thành phần thực thi nào.

```text
channels/
   │
   ▼
Channel Registry
   │
   ▼
channel-vietnam-discovery
   │
   ├── channel.yaml
   ├── rules/
   ├── skills/
   └── memory/
          │
          ▼
     Context Loader
          │
          ▼
      ChannelContext
```

## Channel Registry

Channel Registry biết duy nhất thư mục gốc `<repo>/channels`. Nó nhận `channelId`, kiểm tra identifier, xác nhận channel workspace và `.harness/channel.yaml` tồn tại, rồi trả về các đường dẫn đã được kiểm tra. Registry không nhận raw file path từ Agent hoặc người dùng.

Mỗi lần nạp chỉ bắt đầu từ một workspace đã resolve. Rules, skills và memory đều được suy ra từ workspace đó, vì vậy một run sau này chỉ nhận knowledge của đúng một channel.

## Context Loader

Context Loader thực hiện tuần tự các trách nhiệm logic sau:

1. Resolve workspace qua Channel Registry.
2. Đọc, parse và validate `channel.yaml`.
3. Kiểm tra `channel_id` trong YAML khớp với folder được yêu cầu.
4. Nạp rules và approved memory.
5. Chỉ nạp những skill được yêu cầu trong tùy chọn `skills`.
6. Tính quyền tool hiệu lực và trả về `ChannelContext` chỉ đọc.

Raw object từ YAML không thoát ra ngoài parser. Contract TypeScript dùng camelCase rõ ràng như `channelId`, `maxActiveRuns` và `maxRetriesPerStep`.

## Rules, skills và approved memory

Rules là các ràng buộc Markdown áp dụng cho channel. Loader chỉ đọc file `.md` trực tiếp trong `.harness/rules/` và sắp xếp theo filename để kết quả deterministic.

Skills mô tả cách thực hiện một loại task. Caller truyền tên logic như `topic-research`; loader tự suy ra `topic-research.md`. Không truyền skill thì không skill nào được nạp. Metadata tool chỉ được đọc từ section Markdown có tiêu đề `Allowed Tools` hoặc `Công cụ được phép`, theo các bullet chứa tên tool. Đây là quy ước hẹp có chủ ý, tránh đưa một Markdown parser phức tạp vào Part 04. Skill không có section hợp lệ sẽ có allowlist rỗng.

Approved Memory là knowledge đã được duyệt, không phải trí nhớ tự học. Part 04 chỉ đọc `.harness/memory/approved-knowledge.md`; nó không promotion, cập nhật hoặc ghi đè memory.

## Quyền sử dụng tool

```text
Channel allowed tools
        ∩
Skill allowed tools
        ↓
Effective allowed tools
```

Với nhiều skill được chọn, loader lấy hợp các tool do những skill đó khai báo rồi giao với allowlist của channel. Thứ tự kết quả theo allowlist của channel. Nếu không có skill hoặc skill không khai báo tool, kết quả là mảng rỗng. Vì vậy skill chỉ có thể thu hẹp quyền, không thể tự cấp quyền vượt channel.

## An toàn filesystem

Channel ID và skill name chỉ chấp nhận identifier chữ thường, chữ số và dấu gạch ngang. Giá trị chứa `..`, `/`, `\`, `%`, drive letter hoặc absolute path đều bị từ chối trước khi resolve.

Mọi candidate path phải nằm dưới root đã xác định. Registry và loader kiểm tra cả path đã resolve lẫn path canonical, không đọc symlink cho workspace, `.harness`, file config, thư mục knowledge hoặc file Markdown. Loader không quét nested directory và không bao giờ đọc `.env`, `.git`, `node_modules` hay file ngoài `channels/`.

## Checksum và context snapshot

Mỗi rule, skill và memory có SHA-256 tính trực tiếp từ bytes đã đọc. Checksum giúp checkpoint hoặc audit ở part sau xác định chính xác phiên bản context đã được dùng mà không tạo một hệ thống version-control mới.

`createContextSnapshot` tạo metadata nhẹ gồm channel ID, relative path, checksum của rules/skills/memory và `effectiveAllowedTools`. Snapshot không chứa nội dung tài liệu và chưa được lưu vào PostgreSQL trong Part 04.

## Runtime state và channel knowledge

PostgreSQL tiếp tục là source of truth cho Harness Run, Checkpoint, Audit Event và Tool Call. Channel workspace là source cho cấu hình và knowledge đã được duyệt. Context Loader không đưa `channel.yaml`, rules, skills hoặc approved memory vào database.

Part 04 chỉ đọc context. Nó chưa tạo hoặc cập nhật Run, chưa chuyển state, chưa chạy workflow, Gate, scheduler, Agent, AI provider, MCP hoặc Tool Broker.
