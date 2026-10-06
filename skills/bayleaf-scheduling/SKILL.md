---
name: bayleaf-scheduling
description: Use before creating or changing scheduled tasks, reminders, recurring jobs, or delayed agent work with OpenChamber schedule.* tools in a BayLeaf Sandbox. Explain sleep, missed runs, deletion, timezone, and fresh-session context before promising execution.
---

# Scheduling in a BayLeaf Sandbox

Load this skill before using `schedule.create` or changing when a task runs.
Use the available OpenChamber `schedule.*` tools and their current schemas,
not shell cron, background sleeps, or guessed tool arguments.

## Persistence is not availability

This is an inactivity-managed workspace, not an always-on scheduler:

- Task definitions live on this sandbox's filesystem. They normally survive
  **Restart interface**, sleep/resume, and archive/rehydration of the same
  sandbox. They do not automatically transfer to a replacement sandbox.
- Tasks execute only while OpenChamber is running. Closing a browser tab does
  not stop its server, but sandbox sleep does. Schedules cannot wake it.
- New sandboxes stop after about 1 hour idle and archive after 24 hours stopped.
  Existing machines can have different settings. BayLeaf deletes stopped or
  archived sandboxes after 90 days of recorded inactivity; owner deletion can
  happen sooner. Deletion loses local schedules as well as files and histories.
- Missed runs are **not replayed** when OpenChamber starts again. Recurring tasks
  advance to a future occurrence. A missed one-time task can remain enabled
  without a future run: enabled does not mean it will execute.
- Browser-link expiry is separate from compute lifetime. A 24-hour link does
  not promise 24 hours of running compute.

The usual reason a task will not run tomorrow is **sleep**, not that the sandbox
has already been deleted. Do not claim either uninterrupted availability or
immediate disappearance.

## Choose with the user

- A one-time task later in the current awake work period (for example, in
  15 minutes) can be useful. Explain that it is best effort and needs the
  sandbox and OpenChamber to remain running. A restart across its due time
  can still cause a missed run.
- For “every day at 9am,” overnight work, or a dependable reminder, explain
  that this sandbox cannot promise unattended execution. Prefer a durable
  calendar/reminder or an explicitly authorized always-on scheduling service.
  Do not silently substitute a sandbox task for that requirement.
- If the user knowingly wants an opportunistic recurring sandbox task, obtain
  agreement to the limitation before creating it. Do not disable idle stop,
  manufacture keepalive activity, or add automatic wake machinery to fulfill it.

## Create and verify

1. Resolve the intended project and execution time. Specify the user's chosen
   timezone explicitly: the default is the server's timezone, not necessarily
   theirs. For “in 15 minutes,” compute an actual future date/time from the
   current clock, allowing for date rollover and tool execution delay.
2. Inspect available tasks to avoid unintended duplicates. Listing can
   synchronize the scheduler; it is not just reading a stored file.
3. Supply a self-contained prompt: each run creates a **new agent session**,
   not a continuation of this conversation. Include paths, objective, limits,
   and enough context to act without this transcript. Use current tool schemas
   for model and schedule selection.
4. Do not promise unattended permission approval. A scheduled agent can wait
   for user permission, and inference uses the owner's shared BayLeaf allowance.
5. Verify the returned schedule, timezone, enabled state, and next occurrence
   using the available tools. Report “scheduled, best effort while awake,”
   not “guaranteed.” A one-time task is disabled after its attempt, even if it
   failed; inspect its result before deciding whether to retry.

## Evidence boundary

These persistence and no-catch-up behaviors were inspected in published
OpenChamber 2.1.1 source on 2026-10-06, not qualified by a live schedule/sleep
experiment. Recheck if a later installed version behaves differently. Source:
[scheduler runtime](https://github.com/openchamber/openchamber/blob/e302062e3be0686986594fddabdafd8a97c129e5/packages/web/server/lib/scheduled-tasks/runtime.js)
and
[project storage](https://github.com/openchamber/openchamber/blob/e302062e3be0686986594fddabdafd8a97c129e5/packages/web/server/lib/projects/project-config.js).
