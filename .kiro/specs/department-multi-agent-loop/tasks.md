# Implementation Plan: Department Multi-Agent Loop System

## Overview

Triển khai hệ thống orchestration đa agent theo phòng ban trong Next.js 15 + TypeScript. Các task được chia theo từng component, mỗi task nhỏ và độc lập, build dần từ core types → config → state → agents → hooks → API → CLI.

## Tasks

- [ ] 1. Định nghĩa core types và interfaces
  - Tạo file `lib/agents/types.ts` chứa toàn bộ TypeScript interfaces: `TaskDefinition`, `TaskResult`, `TaskStatus`, `ExecutionContext`, `AgentInvocation`, `VerificationResult`, `ApprovalDecision`
  - Tạo file `lib/agents/errors.ts` chứa các custom error classes: `ConfigNotFoundError`, `ConfigParseError`, `ConfigValidationError`, `ContextLockedError`
  - _Requirements: 1.1, 2.1, 3.2, 4.2, 7.1_

- [ ] 2. Implement ConfigLoader
  - [ ] 2.1 Implement `ConfigLoader` class trong `lib/agents/config-loader.ts`
    - Đọc file `.kiro/agents/departments.yml` (hoặc `.json`) bằng `fs.readFile`
    - Parse YAML với thư viện `js-yaml`, parse JSON với `JSON.parse`
    - Throw `ConfigNotFoundError` nếu file không tồn tại
    - Throw `ConfigParseError` nếu YAML/JSON malformed
    - _Requirements: 1.1, 1.2_

  - [ ] 2.2 Implement `validate()` method trong ConfigLoader
    - Kiểm tra đúng 1 leader agent ở top-level
    - Kiểm tra mỗi department có đúng 1 agent với `role: loop`
    - Kiểm tra mỗi agent entry có đủ `agent_id`, `role`, `prompt_template`
    - Kiểm tra tất cả `prompt_template` file paths tồn tại trong workspace
    - Trả về `ValidationResult` với `valid` và `errors[]`
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [ ]* 2.3 Viết property test cho ConfigLoader (P1)
    - **Property 1: Config validation produces descriptive errors**
    - **Validates: Requirements 1.2**

  - [ ]* 2.4 Viết property test cho loop agent count (P2)
    - **Property 2: Exactly one Loop Agent per Department**
    - **Validates: Requirements 1.5, 1.8**

  - [ ]* 2.5 Viết property test cho leader agent count (P3)
    - **Property 3: Exactly one Leader Agent in config**
    - **Validates: Requirements 1.6, 1.7**

  - [ ]* 2.6 Viết property test cho missing required fields (P4)
    - **Property 4: Agent entry missing required fields always fails validation**
    - **Validates: Requirements 1.4**

  - [ ]* 2.7 Viết property test cho non-existent prompt_template paths (P5)
    - **Property 5: Non-existent prompt_template paths fail validation**
    - **Validates: Requirements 1.9**

- [ ] 3. Checkpoint — Đảm bảo ConfigLoader tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement ExecutionContext và StateStore
  - [ ] 4.1 Implement `ExecutionContextManager` trong `lib/agents/execution-context.ts`
    - Tạo mới ExecutionContext từ TaskDefinition
    - Append `AgentInvocation` vào context (reject nếu status là `pending_approval`)
    - Append `VerificationResult` vào context
    - Set `leader_decision`, cập nhật `status`, `completed_at`
    - Increment `revision_count`
    - _Requirements: 2.6, 2.8, 3.8, 4.8_

  - [ ] 4.2 Implement `StateStore` trong `lib/agents/state-store.ts`
    - `save()`: atomic write dùng pattern `write to .tmp` rồi `fs.rename`
    - `load()`: đọc và parse JSON từ `.kiro/state/{task_id}.json`
    - `list()`: liệt kê tất cả task_id từ thư mục `.kiro/state/`
    - _Requirements: 7.4, 7.5_

  - [ ]* 4.3 Viết property test cho context isolation (P9)
    - **Property 9: Execution context isolation between concurrent tasks**
    - **Validates: Requirements 2.8**

  - [ ]* 4.4 Viết property test cho state persistence (P25)
    - **Property 25: State persisted after each agent completion**
    - **Validates: Requirements 7.4**

  - [ ]* 4.5 Viết property test cho state recovery (P26)
    - **Property 26: State recovery resumes from last completed step**
    - **Validates: Requirements 7.5**

- [ ] 5. Implement HookEmitter
  - [ ] 5.1 Implement `HookEmitter` class trong `lib/agents/hook-emitter.ts`
    - `register()`: đăng ký handler cho một event type, lưu theo thứ tự registration
    - `emit()`: gọi tất cả handlers theo thứ tự đăng ký; nếu handler có `async: true` thì không await; catch lỗi từ handler, log và tiếp tục
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 5.2 Viết property test cho hook handler errors (P21)
    - **Property 21: Hook handler errors do not alter task status**
    - **Validates: Requirements 6.4**

  - [ ]* 5.3 Viết property test cho multiple handlers execution order (P22)
    - **Property 22: Multiple hook handlers execute in registration order**
    - **Validates: Requirements 6.5**

- [ ] 6. Implement LoopAgent và LeaderAgent
  - [ ] 6.1 Implement `LoopAgent` class trong `lib/agents/loop-agent.ts`
    - Nhận `ExecutionContext`, đọc `prompt_template` của loop agent
    - Evaluate output so với `goal`, trả về `VerificationResult` với `result` và `reason`
    - _Requirements: 3.1, 3.2, 3.7_

  - [ ] 6.2 Implement `LeaderAgent` class trong `lib/agents/leader-agent.ts`
    - Nhận `ExecutionContext`, đọc `prompt_template` của leader agent
    - Trả về `ApprovalDecision` với `decision` và `reason`
    - _Requirements: 4.1, 4.2, 4.6_

  - [ ]* 6.3 Viết property test cho Loop và Leader result fields (P11)
    - **Property 11: Loop and Leader results always contain required fields**
    - **Validates: Requirements 3.2, 3.7, 4.2, 4.6**

- [ ] 7. Implement AgentOrchestrator — core execution flow
  - [ ] 7.1 Implement `AgentOrchestrator` class trong `lib/agents/orchestrator.ts`
    - Constructor nhận `ConfigLoader`, `StateStore`, `HookEmitter`, `LoopAgent`, `LeaderAgent`
    - `submitTask()`: validate department_id, tạo ExecutionContext, persist, emit `preTaskExecution`, bắt đầu agent sequence
    - Thực thi Department Agents theo thứ tự trong config, capture output vào context, persist sau mỗi agent
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ] 7.2 Implement revision cycle logic trong AgentOrchestrator
    - Sau khi Department Agents xong: invoke LoopAgent
    - Nếu `needs_revision` và `revision_count < 3`: increment count, re-execute agents
    - Nếu `failed`: set status `failed`, emit `agentStop`
    - Nếu `passed`: chuyển sang Leader review, set status `pending_approval`
    - Nếu Leader `revision_requested` và `revision_count < 3`: increment count, re-execute
    - Nếu Leader `rejected`: set status `rejected`, emit `agentStop`
    - Nếu `revision_count >= 3`: set status `failed`
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 4.3, 4.4, 4.5, 4.7, 4.8_

  - [ ] 7.3 Implement `getTaskStatus()` và `resumeTask()` trong AgentOrchestrator
    - `getTaskStatus()`: load từ StateStore, trả về null nếu không tìm thấy
    - `resumeTask()`: load state, xác định agent cuối đã hoàn thành, tiếp tục từ đó
    - _Requirements: 7.2, 7.3, 7.5_

  - [ ]* 7.4 Viết property test cho unknown department_id (P6)
    - **Property 6: Unknown department_id always fails task submission**
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 7.5 Viết property test cho agent execution order (P7)
    - **Property 7: Agent execution order matches config order**
    - **Validates: Requirements 2.5**

  - [ ]* 7.6 Viết property test cho agent output captured (P8)
    - **Property 8: Agent output always captured in context**
    - **Validates: Requirements 2.6, 7.6**

  - [ ]* 7.7 Viết property test cho Loop Agent invoked after all Department Agents (P10)
    - **Property 10: Loop Agent always invoked after all Department Agents**
    - **Validates: Requirements 3.1**

  - [ ]* 7.8 Viết property test cho revision count increment (P12)
    - **Property 12: Revision count increments by exactly 1 per cycle**
    - **Validates: Requirements 3.8, 4.4**

  - [ ]* 7.9 Viết property test cho max 3 revision cycles (P13)
    - **Property 13: Maximum 3 revision cycles enforced**
    - **Validates: Requirements 3.6, 4.7**

  - [ ]* 7.10 Viết property test cho pending_approval locks context (P14)
    - **Property 14: pending_approval status locks context from modification**
    - **Validates: Requirements 4.8**

  - [ ]* 7.11 Viết property test cho valid state machine transitions (P23)
    - **Property 23: Valid state machine transitions only**
    - **Validates: Requirements 7.1**

  - [ ]* 7.12 Viết property test cho preTaskExecution hook timing (P27)
    - **Property 27: preTaskExecution hook fired before first agent invocation**
    - **Validates: Requirements 2.4, 6.1**

- [ ] 8. Checkpoint — Đảm bảo Orchestrator tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement ReportGenerator
  - [ ] 9.1 Implement `ReportGenerator` class trong `lib/agents/report-generator.ts`
    - Sinh markdown report với 6 sections: Task Summary, Department & Agents, Execution Timeline, Loop Verification Results, Leader Decision, Final Status
    - Execution Timeline sort theo `started_at` ascending
    - Truncate agent output tại 500 ký tự
    - Set `max_revisions_exceeded: true` nếu task fail do vượt revision limit
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 9.2 Implement atomic file write và collision avoidance trong ReportGenerator
    - Atomic write: write to `.tmp` rồi `fs.rename`
    - Collision avoidance: kiểm tra file tồn tại, append `-2`, `-3`, ... nếu trùng
    - _Requirements: 5.8, 5.9_

  - [ ] 9.3 Wire ReportGenerator vào AgentOrchestrator
    - Gọi `generate()` sau khi task đạt terminal status (`completed`, `failed`, `rejected`)
    - Emit `postTaskExecution` với `report_file_path` sau khi report được tạo
    - _Requirements: 5.1, 6.2_

  - [ ]* 9.4 Viết property test cho report generated for every terminal status (P15)
    - **Property 15: Report generated for every terminal status**
    - **Validates: Requirements 5.1**

  - [ ]* 9.5 Viết property test cho report required sections (P16)
    - **Property 16: Report contains all required sections and fields**
    - **Validates: Requirements 5.2, 5.3, 5.5, 5.6**

  - [ ]* 9.6 Viết property test cho report timeline order (P17)
    - **Property 17: Report execution timeline is chronologically ordered**
    - **Validates: Requirements 5.4**

  - [ ]* 9.7 Viết property test cho max_revisions_exceeded flag (P18)
    - **Property 18: max_revisions_exceeded flag set correctly**
    - **Validates: Requirements 5.7**

  - [ ]* 9.8 Viết property test cho atomic report write (P19)
    - **Property 19: Report file written atomically**
    - **Validates: Requirements 5.8**

  - [ ]* 9.9 Viết property test cho filename collision avoidance (P20)
    - **Property 20: Report filename collision avoidance**
    - **Validates: Requirements 5.9**

- [ ] 10. Implement Next.js API Routes
  - [ ] 10.1 Tạo route handler `app/api/tasks/route.ts`
    - `POST /api/tasks`: nhận `TaskDefinition`, gọi `orchestrator.submitTask()`, trả về `TaskResult`
    - Validate request body, trả về 400 nếu thiếu fields
    - _Requirements: 7.2_

  - [ ] 10.2 Tạo route handler `app/api/tasks/[task_id]/route.ts`
    - `GET /api/tasks/:task_id`: gọi `orchestrator.getTaskStatus()`, trả về `ExecutionContext`
    - Trả về 404 với `not_found` error nếu task_id không tồn tại
    - _Requirements: 7.2, 7.3_

  - [ ]* 10.3 Viết property test cho query returns correct context (P24)
    - **Property 24: Query returns correct context for task_id**
    - **Validates: Requirements 7.2**

- [ ] 11. Implement CLI script
  - Tạo `scripts/agent-cli.ts` với các commands:
    - `submit --task-id <id> --department <dept> --title <title> --goal <goal>`: submit task
    - `status --task-id <id>`: query task status
    - `resume --task-id <id>`: resume incomplete task
  - In output dạng human-readable, in error message rõ ràng khi task_id không tồn tại
  - _Requirements: 7.2, 7.3_

- [ ] 12. Tạo sample config và prompt templates
  - Tạo file `.kiro/agents/departments.yml` với ví dụ departments `engineering` và `qa`
  - Tạo các prompt template files trong `.kiro/agents/prompts/` cho từng agent role
  - _Requirements: 1.1, 1.3, 1.4_

- [ ] 13. Viết integration tests
  - [ ]* 13.1 Viết integration test end-to-end với mock agents
    - Test full flow: submit → agents execute → loop verify → leader approve → report generated
    - Test revision cycle flow với mock loop agent trả về `needs_revision` rồi `passed`
    - _Requirements: 2.1–2.8, 3.1–3.8, 4.1–4.8_

  - [ ]* 13.2 Viết integration test cho state recovery
    - Simulate process restart bằng cách load state từ disk và resume
    - Verify resume bắt đầu từ agent cuối đã hoàn thành
    - _Requirements: 7.5_

  - [ ]* 13.3 Viết integration test cho hook system
    - Test multiple handlers, async handlers, handler error không ảnh hưởng task status
    - _Requirements: 6.4, 6.5, 6.6_

- [ ] 14. Final checkpoint — Đảm bảo tất cả tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks đánh dấu `*` là optional, có thể bỏ qua để MVP nhanh hơn
- Mỗi task tham chiếu requirements cụ thể để traceability
- Property tests dùng `fast-check` với minimum 100 iterations
- Atomic write pattern dùng cho cả StateStore và ReportGenerator
- Test files đặt trong `lib/agents/__tests__/` theo cấu trúc trong design
