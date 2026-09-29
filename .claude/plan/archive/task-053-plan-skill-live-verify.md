# Task 053 — Xac minh song plan-skill

- **Vertical slice:** quan sat tren plugin cai lai (khong code)
- **Depends on:** 052
- **Spec refs:** `testing.md` (Verification-first), `ARCHIVE.md` (residual risk: gate chua quan sat)
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** 4 ca duoi day ghi ket qua that; ca nao khong chay thi ghi "chua quan sat", khong duoc coi la xong

## Goal (one sentence)
Chot bang quan sat that hook `plan-skill-inject` va description hoat dong the nao voi `/plan`, Shift+Tab va `/ccf:plan`.

## Acceptance criteria (verifiable)
- [ ] Plugin chay tu ban cache: cai lai/reload roi moi thu
- [ ] Ca 1: Shift+Tab sang plan mode roi go yeu cau thuong, model nhan chi dan va goi `ccf:plan`
- [ ] Ca 2: `/plan <yeu cau>`, ghi lai hook co nhan prompt hay khong (van de chua biet trong ke hoach)
- [ ] Ca 3: `/ccf:plan` ngoai plan mode van bi `plan-mode-guard` chan
- [ ] Ca 4: hoi dap thuan ve code trong plan mode khong bi ep chay quy trinh
- [ ] Ket qua ghi vao ARCHIVE.md khi retire iteration

## Test first (write before implementing)
Khong ap dung: day la buoc quan sat.

## Files to touch
- .claude/plan/ARCHIVE.md — ghi ket qua khi retire (qua `/ccf:updatespec`)
