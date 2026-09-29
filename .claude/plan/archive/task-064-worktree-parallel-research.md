# Task 064 — Nghiên cứu: chạy task song song bằng worktree + Jev chia task

- **Loại:** chỉ nghiên cứu và đề xuất. Chưa có code, chưa thêm vào bảng backlog của `PLAN.md` (một hàng `todo` ở đó sẽ bị `lib/plan.mjs` đếm là việc đang mở).
- **Ngày:** 2026-09-29, Claude Code 2.1.284.
- **Nguồn:** một agent nghiên cứu (read-only) tổng hợp docs Claude Code, docs git và bài viết thực hành. Em tự đọc `hooks/lib/slice-check.mjs`, `scripts/jev-slice-check.mjs`, `skills/plan/SKILL.md` bước 4 đến 6, và chạy thử phần tính trùng file trên 5 task hiện có. Mỗi nhận định dưới đây ghi rõ là **[nguồn]**, **[đo trong repo]** hay **[suy luận]**.

## Kết luận ngắn
- **Giữ tuần tự làm mặc định. Song song chỉ nên là opt-in, và chỉ mở cho những wave mà code chứng minh được là tách rời.**
- **Jev chỉ được phép THÊM ràng buộc (bắt chạy tuần tự), không bao giờ là bằng chứng hai task độc lập.** Sự độc lập phải được xác minh lại sau khi code xong, bằng diff thật, `git merge-tree` và test trên kết quả đã merge.
- Với chính repo CCF, lợi ích gần như bằng 0. Gần như mọi task đều đụng spec và rule chung (xem mục "Đo trên plan hiện tại"). Lợi ích thật chỉ có ở project đích nào có backlog nhiều feature rời nhau.
- **Không chạy task bằng subagent trong worktree.** Làm vậy là đưa writer agent quay lại, đúng thứ CCF vừa bỏ. Mỗi worktree là một session `claude -w` do người mở.

## 1. Đo trên plan hiện tại (058 đến 062)
**[đo trong repo]** Em cho `extractFiles` + `mergeSliceAnswers` chạy trên 5 task file, không gọi Jev. Kết quả là 3 wave: `[058, 059]`, `[060, 061]`, `[062]`. Hai lỗi lộ ra ngay:
- **Bỏ sót trùng file.** 060 ghi `plugins/ccf/commands/{check updatespec}.md`, 061 ghi `plugins/ccf/commands/check.md`. `extractFiles` không bung được dấu ngoặc nhọn nên không thấy hai task cùng sửa `check.md`. Tương tự, 060 ghi `architecture.md` trần còn 061 ghi `.claude/rules/{architecture tooling}.md`. Kết quả: 060 và 061 bị xếp chạy song song, trong khi cả hai sửa cùng file. Hơn nữa 061 cần marker `PARTIAL:` do 060 tạo ra.
- **Không có câu trả lời thì coi như độc lập.** Gọi với `results = []` (tức Jev không trả lời gì), hàm vẫn cho ra wave và không tạo cạnh phụ thuộc nào. Chỉ riêng lô Jev hỏng mới được ghi vào `skipped`; câu trả lời thiếu hay sai dạng thì âm thầm bị coi là "không phụ thuộc". Với việc sắp thứ tự khi plan tuần tự thì chấp nhận được. Với việc quyết chạy song song thì sai hướng: phải coi thiếu câu trả lời là phụ thuộc.
- Nếu đọc đúng đường dẫn, 5 task này gần như nối thành một chuỗi (`tooling.md`, `prompt-standard.md`, `check.md`, `CLAUDE.md` là file chung), nên không có gì để chạy song song.

Bài học: phần "chắc chắn vì code tính" của `slice-check` chỉ chắc chắn bằng danh sách `Files to touch`. Đó là dự đoán viết trước khi có code, không phải sự thật.

## 2. Jev đánh giá dependency

### Input và output
- **Input:** dùng lại state của `slice-check` gồm id, title, `Files to touch` đã chuẩn hóa, và acceptance criteria của các task còn mở. Không gửi source code. Bổ sung một trường cho mỗi task: danh sách "hotspot" mà task chạm tới (mục 2b).
- **Câu hỏi Noul cho mỗi cặp (i, j):** giữ `dep_i_j` và `contract_i_j` như hiện tại. Thêm `shared_state_i_j`: "hai task có cùng đổi config, schema, migration, dependency, file sinh tự động, hay export dùng chung không".
- **Output:** `edges`, `waves`, `skipped` như hiện tại, cộng thêm `unanswered` (các cặp không có câu trả lời hợp lệ) và `parallel_safe: boolean` cho từng wave.

### 2b. Tiêu chí "độc lập"
Hai task A và B được chạy song song khi **tất cả** các điều kiện sau cùng đúng:
1. Không trùng file khai báo, sau khi đã bung `{a,b}` và glob. Đường dẫn nào không phân tích được thì coi là trùng với mọi task (fail-closed).
2. Không cùng chạm một lớp hotspot: lockfile hoặc file khai báo dependency; migration hoặc schema; file sinh tự động hoặc snapshot; file index/barrel export; config dùng chung (`tsconfig.json`, `hooks.json`...); `PLAN.md`, `CLAUDE.md`, `.claude/rules/*`, README, CHANGELOG. Code phát hiện hotspot bằng danh sách mẫu, không cần Jev.
3. Jev trả lời đủ cả 3 câu cho cặp đó, và cả 3 đều dưới ngưỡng. Thiếu câu trả lời thì là phụ thuộc. Ngưỡng cho chế độ song song nên thấp hơn 0.5 (ví dụ 0.3), vì cái giá của hai chiều sai không đối xứng (mục 2c).
4. Không có ràng buộc nào trong plan (một task là refactor chuẩn bị cho task kia, hoặc cần kết quả quan sát của task kia).
5. Người dùng xác nhận các wave trước khi mở worktree.

### 2c. Jev có đủ tin cậy không, và nếu sai thì sao
- **[nguồn]** Không tìm thấy nghiên cứu công bố nào đo khả năng LLM đoán phụ thuộc giữa các task từ văn bản plan. Các con số Jev của task 057 (12/13 tiêu chí chưa đạt được bắt, 1 báo nhầm trên 23) đo completion evidence, không đo dependency. Các câu hỏi `dep_`/`contract_` **chưa từng được đo độ chính xác**.
- **Jev nói "độc lập" nhưng sai (false independence).** Có hai mức thiệt hại:
  - Trùng text: `merge-tree` bắt được trước khi merge. Thiệt hại là làm lại một task trên base mới.
  - Xung đột ngữ nghĩa: merge sạch nhưng chạy sai. **[nguồn]** Nghiên cứu trên 9 hệ thống mã nguồn mở cho thấy loại này thường gặp, và nó lộ ra dưới dạng build hay test hỏng. Chỉ test trên kết quả đã merge mới bắt được, và chỉ khi có test phủ đúng chỗ đó.
- **Jev nói "phụ thuộc" nhưng sai (false dependence):** chỉ mất cơ hội chạy song song, vẫn đúng như hôm nay.
- Vì cái giá lệch hẳn về một phía, Jev chỉ được dùng để cấm song song, không bao giờ để cho phép.
- **Điều kiện trước khi tin Jev:** backtest trên lịch sử có sẵn. `ARCHIVE.md` cùng `git log` có 50+ task với diff thật, và phụ thuộc thật của chúng tính được (file trùng trong diff thật, task sau dùng thứ task trước tạo ra). Dùng tập này làm ground truth, đo recall của `dep_`/`contract_`. Đề xuất chỉ đưa Jev vào quyết định khi recall trên phụ thuộc thật từ 95% trở lên. Dưới mức đó, Jev chỉ là ý kiến tham khảo.

## 3. Vòng đời worktree

### Chạy bằng gì
| Phương án | Đánh giá |
|---|---|
| Subagent với `isolation: "worktree"` **[nguồn: v2.1.49]** | **Loại.** Đưa writer agent quay lại, trái `architecture.md` "Command ↔ agent boundary". Thêm nữa, subagent chạy nền bị cắt bớt tool. |
| `/batch` (chia một thay đổi ra 5 đến 30 subagent trong worktree) **[nguồn]** | **Loại** với cùng lý do. Nó được thiết kế cho một thay đổi lớn, không phải cho các task của một plan. |
| **Mỗi task một session `claude -w <tên>` do người mở** **[nguồn: docs worktrees, common-workflows]** | **Chọn.** Code vẫn được viết ở main loop của từng session với đầy đủ spec, và vẫn tuần tự bên trong session đó. Người dùng kiểm soát số session. |

### Đặt tên
- `claude -w ccf-<iteration>-<taskid>` tạo `.claude/worktrees/ccf-<iteration>-<taskid>/` trên branch `worktree-ccf-<iteration>-<taskid>` **[nguồn]**.
- Tên chứa task id, để script đối chiếu được branch với task.
- `.claude/worktrees/` phải được gitignore **[nguồn]**.

### Tạo và xóa
- **Tạo:** đầu mỗi wave, từ commit tích hợp của wave trước. Không tạo trước cho các wave sau, vì base của chúng chưa tồn tại.
- **Điều kiện tiên quyết, xung đột với luật hiện tại:**
  - **[nguồn]** Worktree chỉ chứa file đã commit. `worktree.baseRef` mặc định là `"fresh"`, tức `origin/HEAD` chứ không phải HEAD local; phải đặt `"head"`.
  - CCF không commit khi người dùng chưa yêu cầu. Nếu không commit, `PLAN.md`, các task file và code chưa commit sẽ không có trong worktree nào.
  - Vì vậy chế độ song song **bắt buộc người dùng đồng ý commit một snapshot base** ở mỗi wave. Đây là cái giá lớn về mặt quy trình.
- **Xóa:**
  - Chỉ xóa sau khi ledger ghi đủ commit merge, và `git merge-base --is-ancestor <head task> <nhánh tích hợp>` đúng.
  - Dùng `git worktree remove` không có `--force`. Nếu git từ chối thì dừng và báo người dùng, không ép xóa.
  - Không để `cleanupPeriodDays` tự quét **[nguồn: quét cả worktree có thay đổi khi hết hạn, trừ khi còn file đổi, untracked hay commit chưa push]**. Ledger mới là nơi quyết định worktree nào còn cần giữ.

### Trạng thái trong session worktree
- **[nguồn]** Trong hook, `${CLAUDE_PROJECT_DIR}` trỏ về checkout chính, còn `cwd` đi theo worktree.
- Quy ước đề xuất: session worktree **không ghi `PLAN.md`**. Status do checkout chính giữ, cập nhật từ ledger, để tránh `PLAN.md` thành điểm conflict trong mọi lần merge.
- Session worktree cũng không chạy `/ccf:updatespec`. Đồng bộ spec làm một lần sau khi merge (mục 6).

## 4. Giao thức merge
Merge là thao tác sửa file, nên theo `architecture.md` nó phải là **script do người chạy** (ví dụ `scripts/integrate-wave.mjs`, mặc định chỉ preview, có `--apply` mới làm thật), không phải hook.

1. **Preflight (chỉ đọc, dừng ngay khi có bất kỳ lỗi nào):**
   - Mỗi branch trong wave có đúng một task tương ứng trong ledger, và ngược lại.
   - Mỗi task đã qua gate trong session của nó (test xanh, `/ccf:check` không có `FAIL:`), có ghi trong ledger.
   - **Chống lẫn thay đổi:** tập file trong diff thật (`git diff --name-only <base>...<branch>`) phải nằm trong `Files to touch` của task đó cộng test của nó. Có file ngoài danh sách thì dừng.
   - Diff thật của các task trong wave đôi một không trùng file.
   - `git merge-tree --write-tree` cho từng branch với nhánh tích hợp, rồi cho từng cặp branch. Đọc **exit code**, không đọc danh sách conflict **[nguồn: docs git nói danh sách rỗng chưa chắc là sạch]**. Cần git 2.38 trở lên.
2. **Merge:** theo thứ tự trong plan, từng branch một, bằng `git merge --no-ff`. Không dùng octopus, vì nó từ chối merge phức tạp và giấu mất task nào làm hỏng build **[nguồn + suy luận]**. Mỗi task thành một commit merge riêng, dễ bisect và dễ revert.
3. **Kiểm tích hợp:** chạy **toàn bộ test sau MỖI lần merge**, không chỉ ở cuối. Đây là quy tắc "not rocket science" / merge queue **[nguồn: GitHub merge queue]**. Test đỏ thì dừng, không merge tiếp. Task vừa merge được revert hoặc làm lại trên base mới.
4. **Conflict:** không bao giờ tự giải. Task thứ hai chuyển về chạy tuần tự trên base mới (sau khi task thứ nhất đã merge). `git rerere` có thể giúp người giải tay nếu phải làm lại nhiều lần.
5. **Sau cả wave:** chạy một `/ccf:check` trên diff gộp của wave, so với base. Review từng task riêng không thấy được lỗi phát sinh khi ghép.
6. **Sau cả iteration:** một task đồng bộ spec/doc duy nhất (số đếm, README, `CLAUDE.md`), chạy tuần tự trên checkout chính.

## 5. Bảo đảm toàn vẹn: ledger
File `.claude/plan/parallel/<iteration>.json`. Chỉ script ghi vào file này (không phải hook), và `lib/*` chỉ đọc. Mỗi task một bản ghi:
`{ id, wave, branch, worktreePath, baseSha, declaredFiles, headSha, actualFiles, gate: {tests, check}, mergeSha, status }`, với `status` đi `planned → running → gated → merged → cleaned`.

Hai kiểm tra do code thực hiện, không dựa vào judgment:
- **Không sót:**
  - Mọi task của iteration có `mergeSha`, và `--is-ancestor` đúng.
  - Hợp của các `actualFiles` bằng `git diff --name-only <base-iteration>..<nhánh tích hợp>`, trừ các file do task đồng bộ spec thêm vào.
  - `git branch --merged` chứa mọi branch trong ledger.
- **Không lẫn:**
  - `actualFiles` của mỗi task là tập con của `declaredFiles` cộng test của nó.
  - Các `actualFiles` trong cùng wave rời nhau.
  - Mỗi commit merge chỉ chứa commit của đúng branch đó.

Script `archive-plan.mjs` nên từ chối retire một iteration khi ledger còn bản ghi chưa `merged`.

## 6. Đối chiếu với luật SEQUENTIAL
**Vẫn bắt buộc tuần tự** (song song không bao giờ được xét):
- phụ thuộc dữ liệu thật: task sau cần kết quả, quyết định hoặc số đo của task trước (ví dụ 060 cần trace eval của 059);
- trùng file (khai báo hoặc thật), trùng contract, trùng hotspot;
- refactor chuẩn bị cho feature (step 4 đã tách hai loại này thành task riêng, nên chúng chạy nối tiếp nhau);
- migration/schema, thay đổi dependency hoặc lockfile;
- task live-verify hoặc task phải quan sát hành vi harness;
- mọi task sửa `CLAUDE.md`, `.claude/rules/*` hay prompt dùng chung. Với repo CCF thì gần như là tất cả.

**Song song an toàn:** các feature dọc rời hẳn nhau trong project đích (ví dụ một trang FE và một endpoint BE không liên quan), không trùng file thật, không trùng hotspot, và có test đủ phủ để bắt xung đột ngữ nghĩa.

**Mâu thuẫn cần người dùng quyết:**
- Step 4 bảo gộp phần đồng bộ doc/số đếm vào từng feature task. Chính cách gộp đó biến mọi task thành "chạm hotspot".
- Muốn chạy song song thì phần đồng bộ phải tách thành một task cuối iteration. Nghĩa là chế độ song song cần một biến thể của luật right-size, không chỉ một cờ bật tắt.

**Đề xuất:** tuần tự là mặc định. Song song là opt-in cho từng iteration, được hỏi ở bước plan chỉ khi code tìm thấy ít nhất một wave có từ 2 task trở lên thỏa đủ mục 2b.

## 7. Chi phí
- **Token [suy luận]:**
  - Tổng token của các task gần như không đổi so với chạy tuần tự, vì mỗi task vẫn được viết một lần.
  - Phần tăng thêm gồm: mỗi session nạp lại spec (khoảng 95KB trả phí, tức khoảng 28K token mỗi session); một lần kiểm tích hợp cho mỗi lần merge; một `/ccf:check` cho mỗi wave; một lần gọi Jev khi plan.
  - **[nguồn]** Anthropic đo hệ multi-agent nghiên cứu dùng khoảng 15 lần token so với chat. Đó là kiểu điều phối khác, nên không áp thẳng được, nhưng cho thấy chi phí điều phối là có thật.
- **Thời gian:** trường hợp tốt nhất, thời gian của wave bằng task dài nhất thay vì tổng các task. **[nguồn]** Anthropic nhận xét việc coding có ít phần song song thật hơn việc nghiên cứu. Thời gian merge, test sau mỗi merge và làm lại khi conflict ăn bớt phần lợi. Không tìm thấy số liệu đo nào của các công cụ worktree (claude-squad, crystal, container-use, sculptor).
- **Chi phí con người:** phải review N diff cùng lúc, và phải đồng ý commit snapshot ở mỗi wave. Nhiều khả năng đây là nút thắt thật, chứ không phải token.

## 8. Rủi ro lớn nhất (theo thứ tự)
1. **Xung đột ngữ nghĩa lọt qua:** merge sạch, test không phủ tới. Chỉ giảm được bằng test sau mỗi merge và `/ccf:check` trên diff gộp, không loại hẳn được.
2. **Danh sách `Files to touch` sai.** Đã thấy thật ở mục 1. Preflight bắt được khi diff thật vượt khai báo, nhưng lúc đó task đã chạy song song rồi.
3. **Yêu cầu commit phá luật "không commit khi chưa được yêu cầu".**
4. **Trạng thái bị tách đôi:** `PLAN.md` và hook đọc checkout chính, trong khi code nằm ở worktree.
5. **Quyết định ngầm không đồng nhất** giữa các session song song (style, helper viết trùng). **[nguồn]** Cognition và các bài thực hành nêu đúng lỗi này.

## 9. Thứ tự triển khai nếu làm thật
Mỗi bước có giá trị riêng, dừng ở bước nào cũng không phí:
1. **Sửa `slice-check`:** bung ngoặc nhọn/glob; thiếu câu trả lời thì coi là phụ thuộc (hoặc ít nhất báo rõ các cặp chưa được trả lời); thêm danh sách hotspot. Việc này có ích ngay cho plan tuần tự.
2. **Backtest Jev** trên lịch sử `ARCHIVE.md` + `git log`, đo recall phụ thuộc. Đây là điểm quyết định có đi tiếp hay không (ngưỡng 95%).
3. **Script preflight chỉ đọc:** ledger, diff thật so với khai báo, `merge-tree` từng cặp. Dùng được cả khi người dùng tự chạy song song bằng tay.
4. **Script `integrate-wave` (`--apply`):** merge `--no-ff` tuần tự, test sau mỗi lần merge, kiểm "không sót".
5. **Tài liệu và câu hỏi opt-in ở bước plan:** mở `claude -w` cho từng task, cấu hình `baseRef: "head"`, gitignore `.claude/worktrees/`.

Không bước nào cần subagent viết code.

## Nguồn chính
- Claude Code: https://code.claude.com/docs/en/worktrees , /en/sub-agents , /en/agents , /en/common-workflows ; CHANGELOG (2.1.49, 2.1.50, 2.1.72, 2.1.105, 2.1.157, 2.1.198, 2.1.206, 2.1.210, 2.1.216, 2.1.222, 2.1.247)
- Git: https://git-scm.com/docs/git-worktree , /git-merge-tree , /merge-strategies , /git-rerere , /git-range-diff
- Xung đột ngữ nghĩa: https://dl.acm.org/doi/10.1145/2025113.2025139 ; GitHub merge queue docs
- Thực hành: https://www.anthropic.com/engineering/multi-agent-research-system ; https://cognition.com/blog/dont-build-multi-agents (qua bản tóm tắt, không tải trực tiếp được)
- Trong repo: `plugins/ccf/hooks/lib/slice-check.mjs`, `plugins/ccf/skills/plan/SKILL.md` bước 4 đến 6, `.claude/rules/architecture.md`
