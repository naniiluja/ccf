# CCF — Claude Context First

[English](./README.md) · **Tiếng Việt** · [简体中文](./README.zh-CN.md)

Một plugin cho [Claude Code](https://code.claude.com) giúp trợ lý AI viết code của bạn làm việc có kỷ luật: lập plan trước, giữ spec dự án luôn mới, kiểm tra thành phẩm đúng spec, và chạy song song các task độc lập.

## Vì sao nên dùng

Claude Code thuần là một trợ lý giỏi nhưng hay quên. Session càng dài, nó càng quên rule dự án, plan đang làm dở thì trượt sang sửa file, và chẳng bao giờ nhắc bạn cập nhật tài liệu. CCF thêm ba thói quen bám rất chắc:

- **Plan trước, code sau.** `/ccf:plan` chỉ chạy được ở plan mode, nên bước lập kế hoạch luôn ở chế độ chỉ đọc, xem lại được. Không còn chuyện sửa nhầm file.
- **Spec luôn mới.** Hook (script nhỏ tự chạy theo sự kiện của session) nhắc bạn cập nhật spec mỗi khi code đổi. Bài học rút ra được lưu vào memory hệ thống, lỗi cũ không lặp lại.
- **Check trước khi xong.** `/ccf:check` cho hai reviewer độc lập soi thành phẩm đúng spec. Task nào chưa qua check thì chưa được tính là xong.

## Cài đặt

Trong Claude Code:

```
/plugin marketplace add naniiluja/ccf
/plugin install ccf@ccf
```

Hoặc một lệnh duy nhất: `npx @naniiluja/ccf`

Sau đó mở Claude Code trong thư mục dự án và chạy `/ccf:init`.

## 5 lệnh

| Lệnh | Nói dễ hiểu là |
|---|---|
| `/ccf:init` | Dựng CCF cho dự án. Nó hỏi bạn vài câu rồi viết spec dự án (`CLAUDE.md`). Dự án có sẵn thì nó đọc code thật trước rồi viết spec theo đúng cấu trúc đó. |
| `/ccf:plan` | Chẻ một feature thành các slice nhỏ có thứ tự (database, rồi service, rồi UI), mỗi slice có test riêng. Cần bật plan mode (Shift+Tab). |
| `/ccf:cook` | Chạy các slice theo wave song song. Task nào không liên quan nhau thì chạy cùng lúc, mỗi task trong một bản copy riêng của repo (git worktree); merge xong là chạy test. |
| `/ccf:check` | Review thành phẩm đúng spec. Bước bắt buộc duy nhất trước khi task được đánh dấu xong. |
| `/ccf:updatespec` | Ghi bài học của session này vào spec và memory hệ thống. |

Luồng thường dùng: `/ccf:init` → `/ccf:plan` → `/ccf:cook` → `/ccf:check` → `/ccf:updatespec`.

## Bên dưới nắp capo

Không cần đọc mục này vẫn dùng được CCF. Dành cho ai tò mò.

- **Hook** là lớp chắc chắn nhất. Command và agent chỉ là prompt, model có thể lờ đi. Hook là script chạy theo sự kiện session, lần nào cũng chạy: chặn `/ccf:plan` ngoài plan mode, nhắc cập nhật spec khi code đổi, nạp lại task đang dở sau khi compact.
- **Agent** là 6 trợ lý chỉ đọc: một đọc từng phần codebase, một tra best practice từ tài liệu chính thức, một soạn thảo spec, hai reviewer soi code, và một tìm cách bác bỏ từng lỗi chặn trước khi bạn xử lý. Không ai trong số đó viết code. Bạn viết code trực tiếp trong session.
- **Script** là 11 công cụ dòng lệnh chỉ chạy khi bạn (hoặc một lệnh, sau khi hỏi bạn) khởi động, vì chúng sửa file hoặc gọi API bên ngoài. Trong đó: `prune-archive.mjs` dọn file task của các iteration cũ đã xong (archive và lịch sử git vẫn giữ lại), còn `memory-audit.mjs` báo cho `/ccf:updatespec` khi memory hệ thống đã phình đến mức cần dọn, `spec-budget.mjs` đo số byte spec mà mỗi session phải nạp, và `eval-changelog.mjs` ghi điểm eval của mỗi bản phát hành (hoặc lý do không chạy) vào `CHANGELOG.md`.
- **Tra tài liệu ngay trong plugin.** CCF đi kèm Context7 và Microsoft Learn (MCP server), nên lời khuyên thiết kế trích từ tài liệu thật, không phải từ trí nhớ của model.

Tài liệu nội bộ đầy đủ: [plugins/ccf/README.md](./plugins/ccf/README.md). Hook cần Node ≥ 18.

## License

MIT

## Lời cảm ơn

Dự án ra mắt lần đầu tại cộng đồng [LINUX DO](https://linux.do/). Cảm ơn mọi người đã ủng hộ và góp ý.
