# Requirements Document

## Introduction

Tính năng **Department Multi-Agent Loop System** xây dựng một hệ thống tự động hóa đa agent theo phòng ban trong IDE Kiro. Mỗi phòng ban sở hữu một tập agent chuyên biệt để xử lý các task thuộc domain của mình. Sau khi agent hoàn thành quy trình, một **Loop Agent** kiểm tra lại toàn bộ output để đảm bảo mục tiêu đã đạt. Cuối cùng, **Leader Agent** là người phê duyệt và chốt kết quả. Khi task hoàn tất, hệ thống tự động sinh một file markdown báo cáo tổng kết.

Hệ thống tích hợp với Kiro Hook System (sự kiện `preTaskExecution`, `postTaskExecution`, `agentStop`) và được cấu hình qua file YAML/JSON trong workspace.

---

## Glossary

- **Multi_Agent_System**: Hệ thống điều phối nhiều agent theo phòng ban trong Kiro IDE
- **Department**: Một phòng ban logic (ví dụ: Engineering, QA, Design, HR) sở hữu một tập agent riêng
- **Department_Agent**: Agent chuyên biệt thuộc một Department, thực thi task trong domain của phòng ban đó
- **Loop_Agent**: Agent kiểm tra lại output sau khi Department_Agent hoàn thành, xác nhận mục tiêu đã đạt
- **Leader_Agent**: Agent cấp cao nhất, phê duyệt kết quả cuối cùng và chốt trạng thái task
- **Task**: Một đơn vị công việc được giao cho một Department, có mục tiêu rõ ràng và tiêu chí hoàn thành
- **Task_Goal**: Mô tả mục tiêu cần đạt của một Task, dùng làm cơ sở để Loop_Agent kiểm tra
- **Verification_Result**: Kết quả kiểm tra của Loop_Agent: `passed` | `failed` | `needs_revision`
- **Approval_Decision**: Quyết định của Leader_Agent: `approved` | `rejected` | `revision_requested`
- **Agent_Config**: File cấu hình YAML/JSON định nghĩa Department, agent roles, và hook bindings
- **Execution_Context**: Tập hợp thông tin runtime của một Task: input, output, logs, trạng thái từng agent
- **Report_File**: File markdown được sinh tự động khi Task hoàn tất, chứa tóm tắt toàn bộ quá trình
- **Hook_Event**: Sự kiện từ Kiro Hook System: `preTaskExecution`, `postTaskExecution`, `agentStop`
- **Revision_Cycle**: Một vòng lặp sửa đổi khi Loop_Agent hoặc Leader_Agent yêu cầu chỉnh sửa

---

## Requirements

### Requirement 1: Cấu hình phòng ban và agent roles

**User Story:** As a developer, I want to define departments and their agents via a configuration file, so that the system knows which agents belong to which department and what roles they play.

#### Acceptance Criteria

1. THE Multi_Agent_System SHALL read an Agent_Config file located at `.kiro/agents/departments.yml` (or `.json`) in the workspace root.
2. WHEN the Agent_Config file is absent or malformed, THE Multi_Agent_System SHALL return a descriptive error message specifying the file path and the validation failure reason.
3. THE Multi_Agent_System SHALL support defining multiple Departments, each with: a unique `department_id` (kebab-case), a `display_name`, a list of Department_Agents, and an optional `description`.
4. THE Multi_Agent_System SHALL require each Department_Agent entry to specify: `agent_id` (unique within the department), `role` (one of `executor` | `reviewer` | `specialist`), and `prompt_template` (path to a `.md` file or inline string).
5. THE Multi_Agent_System SHALL require exactly one Loop_Agent per Department, identified by `role: loop`.
6. THE Multi_Agent_System SHALL require exactly one Leader_Agent in the entire Agent_Config, identified by `role: leader` at the top level (not scoped to a Department).
7. IF the Agent_Config defines more than one Leader_Agent, THEN THE Multi_Agent_System SHALL return a validation error and halt initialization.
8. IF a Department contains no agent with `role: loop`, THEN THE Multi_Agent_System SHALL return a validation error for that Department and halt initialization.
9. THE Multi_Agent_System SHALL validate that all `prompt_template` file paths referenced in Agent_Config exist in the workspace before starting any Task.

---

### Requirement 2: Thực thi task theo phòng ban

**User Story:** As a developer, I want to assign a task to a department and have its agents execute it in sequence, so that domain-specific work is handled by the right agents.

#### Acceptance Criteria

1. THE Multi_Agent_System SHALL accept a Task definition containing: `task_id`, `department_id`, `title`, `description`, and `goal` (the Task_Goal used for verification).
2. WHEN a Task is submitted, THE Multi_Agent_System SHALL verify that the specified `department_id` exists in Agent_Config before starting execution.
3. IF the specified `department_id` does not exist in Agent_Config, THEN THE Multi_Agent_System SHALL return an error and set the Task status to `failed`.
4. WHEN a Task starts, THE Multi_Agent_System SHALL trigger the `preTaskExecution` Hook_Event with the Task's Execution_Context.
5. THE Multi_Agent_System SHALL execute Department_Agents within a Department in the order they are defined in Agent_Config.
6. WHEN a Department_Agent completes its work, THE Multi_Agent_System SHALL capture the agent's output and append it to the Execution_Context.
7. WHEN a Department_Agent fails with an unhandled error, THE Multi_Agent_System SHALL trigger the `agentStop` Hook_Event, record the error in Execution_Context, and halt the agent sequence for that Department.
8. THE Multi_Agent_System SHALL maintain an isolated Execution_Context per Task, ensuring outputs from one Task do not affect another Task running concurrently.

---

### Requirement 3: Loop Agent kiểm tra kết quả

**User Story:** As a developer, I want a loop agent to automatically verify the department agents' output against the task goal, so that incomplete or incorrect results are caught before reaching the leader.

#### Acceptance Criteria

1. WHEN all Department_Agents in a Department have completed, THE Multi_Agent_System SHALL automatically invoke the Loop_Agent for that Department.
2. THE Loop_Agent SHALL evaluate the combined output in Execution_Context against the Task_Goal and produce a Verification_Result of `passed`, `failed`, or `needs_revision`.
3. WHEN the Loop_Agent produces `passed`, THE Multi_Agent_System SHALL advance the Task to the Leader_Agent approval step.
4. WHEN the Loop_Agent produces `needs_revision`, THE Multi_Agent_System SHALL re-execute the Department_Agents sequence (a Revision_Cycle) with the Loop_Agent's feedback appended to the Execution_Context.
5. WHEN the Loop_Agent produces `failed`, THE Multi_Agent_System SHALL set the Task status to `failed`, trigger the `agentStop` Hook_Event, and skip the Leader_Agent step.
6. THE Multi_Agent_System SHALL enforce a maximum of 3 Revision_Cycles per Task. IF the Loop_Agent has not produced `passed` after 3 Revision_Cycles, THEN THE Multi_Agent_System SHALL set the Task status to `failed` and generate a Report_File documenting the failure.
7. THE Loop_Agent SHALL include in its Verification_Result a `reason` field (string) explaining the decision, regardless of the outcome.
8. WHEN a Revision_Cycle begins, THE Multi_Agent_System SHALL increment the `revision_count` in Execution_Context by 1.

---

### Requirement 4: Leader Agent phê duyệt cuối cùng

**User Story:** As a developer, I want a leader agent to make the final approval decision, so that there is a single authoritative checkpoint before a task is marked complete.

#### Acceptance Criteria

1. WHEN the Loop_Agent produces `passed`, THE Multi_Agent_System SHALL submit the full Execution_Context to the Leader_Agent for review.
2. THE Leader_Agent SHALL produce an Approval_Decision of `approved`, `rejected`, or `revision_requested`.
3. WHEN the Leader_Agent produces `approved`, THE Multi_Agent_System SHALL set the Task status to `completed` and trigger the `postTaskExecution` Hook_Event.
4. WHEN the Leader_Agent produces `revision_requested`, THE Multi_Agent_System SHALL re-execute the Department_Agents sequence (a Revision_Cycle) with the Leader_Agent's feedback appended to the Execution_Context, then re-run the Loop_Agent.
5. WHEN the Leader_Agent produces `rejected`, THE Multi_Agent_System SHALL set the Task status to `rejected` and trigger the `agentStop` Hook_Event.
6. THE Leader_Agent SHALL include in its Approval_Decision a `reason` field (string) explaining the decision.
7. THE Multi_Agent_System SHALL enforce a combined maximum of 3 Revision_Cycles across both Loop_Agent and Leader_Agent feedback. IF the combined `revision_count` reaches 3 without `approved`, THEN THE Multi_Agent_System SHALL set the Task status to `failed`.
8. WHILE the Leader_Agent is processing, THE Multi_Agent_System SHALL set the Task status to `pending_approval` and prevent any other agent from modifying the Execution_Context.

---

### Requirement 5: Sinh báo cáo markdown khi hoàn thành

**User Story:** As a developer, I want the system to automatically generate a markdown report when a task finishes, so that I have a clear record of what was done, who did it, and what the outcome was.

#### Acceptance Criteria

1. WHEN a Task reaches a terminal status (`completed`, `failed`, or `rejected`), THE Multi_Agent_System SHALL generate a Report_File at `.kiro/reports/{task_id}-{YYYY-MM-DD}.md`.
2. THE Report_File SHALL contain the following sections: Task Summary, Department & Agents, Execution Timeline, Loop Verification Results, Leader Decision, and Final Status.
3. THE Report_File Task Summary section SHALL include: `task_id`, `title`, `department_id`, `goal`, `final_status`, `started_at`, and `completed_at`.
4. THE Report_File Execution Timeline section SHALL list each agent invocation in chronological order with: `agent_id`, `role`, `started_at`, `completed_at`, and a truncated output summary (first 500 characters).
5. THE Report_File Loop Verification Results section SHALL list each Verification_Result with: `cycle_number`, `result` (passed/failed/needs_revision), and `reason`.
6. THE Report_File Leader Decision section SHALL include the Approval_Decision, `reason`, and the `revision_count` at the time of decision.
7. IF a Task fails due to exceeding the maximum Revision_Cycles, THEN THE Report_File SHALL include a `max_revisions_exceeded: true` flag in the Final Status section.
8. THE Multi_Agent_System SHALL write the Report_File atomically — the file SHALL NOT be partially written if the generation process is interrupted.
9. WHEN a Report_File already exists for the same `task_id` and date, THE Multi_Agent_System SHALL append a numeric suffix (e.g., `-2`, `-3`) to the filename to avoid overwriting.

---

### Requirement 6: Tích hợp Kiro Hook System

**User Story:** As a developer, I want the multi-agent loop to integrate with Kiro's hook system, so that I can observe and react to agent lifecycle events using standard Kiro hooks.

#### Acceptance Criteria

1. THE Multi_Agent_System SHALL emit the `preTaskExecution` Hook_Event before any Department_Agent begins execution, with the Task's `task_id`, `department_id`, and `goal` in the event payload.
2. THE Multi_Agent_System SHALL emit the `postTaskExecution` Hook_Event when a Task reaches `completed` status, with the Task's `task_id`, `final_status`, and `report_file_path` in the event payload.
3. THE Multi_Agent_System SHALL emit the `agentStop` Hook_Event when any agent (Department_Agent, Loop_Agent, or Leader_Agent) terminates abnormally, with `agent_id`, `task_id`, and `error_message` in the event payload.
4. WHEN a hook handler registered for `postTaskExecution` returns an error, THE Multi_Agent_System SHALL log the error and continue without altering the Task's terminal status.
5. THE Multi_Agent_System SHALL support registering multiple hook handlers for the same Hook_Event, executing them sequentially in registration order.
6. WHERE a hook handler is configured with `async: true` in Agent_Config, THE Multi_Agent_System SHALL execute that handler asynchronously without blocking the main agent loop.

---

### Requirement 7: Trạng thái và quan sát task

**User Story:** As a developer, I want to query the current status and execution context of any running or completed task, so that I can monitor progress and debug issues.

#### Acceptance Criteria

1. THE Multi_Agent_System SHALL maintain a Task status that transitions through: `pending` → `running` → `pending_approval` → `completed` | `failed` | `rejected`.
2. THE Multi_Agent_System SHALL expose a query interface (API endpoint or CLI command) that returns the current status and Execution_Context for a given `task_id`.
3. WHEN a `task_id` does not exist, THE Multi_Agent_System SHALL return a `not_found` error with HTTP 404 (if API) or a descriptive CLI message.
4. THE Multi_Agent_System SHALL persist Execution_Context to disk at `.kiro/state/{task_id}.json` after each agent completes, so that state is recoverable after a process restart.
5. WHEN the Multi_Agent_System restarts and finds an incomplete Task state file, THE Multi_Agent_System SHALL resume the Task from the last completed agent step rather than restarting from the beginning.
6. THE Multi_Agent_System SHALL record `started_at` and `completed_at` timestamps (ISO 8601) for each agent invocation in the Execution_Context.

