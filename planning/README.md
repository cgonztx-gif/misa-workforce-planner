# Planning system

How we plan and track the Texas MISA Costco case. `CLAUDE.md` holds only what every session must know. Everything else lives here.

## Where things go

| File | Holds | Update it when |
|---|---|---|
| `PLAN.md` | Current focus, milestones, every task | A task starts, finishes or changes |
| `REQUIREMENTS.md` | Every case requirement, its source and the tasks that cover it | A requirement is met or the rules change |
| `DECISIONS.md` | Choices made, why, and what was rejected | A choice is proposed, accepted or reversed |
| `DESIGN.md` | How the tool works: data, calculations, modules, demo setup | The design changes |
| `FINDINGS.md` | Verified facts about the data and environment | Something is measured or confirmed |
| `ASSUMPTIONS.md` | Assumptions we add beyond the case's own | The model relies on something unverified |
| `QUESTIONS.md` | Open questions and who can answer them | An unknown appears or an answer arrives |
| `LOG.md` | Dated record of what happened | At the end of every work session |
| `evidence/` | Scripts that reproduce findings, plus their saved output | A finding needs proof |

## IDs

Every item has a permanent ID: `R-` requirement, `T-` task, `D-` decision, `F-` finding, `A-` assumption, `Q-` question. Refer to items by ID. Never reuse or renumber one.

## Rules

1. **Starting work:** read "Current focus" in `PLAN.md`, then the files your task touches.
2. **Finishing work:** update the task status in `PLAN.md`, add an entry to `LOG.md`, and commit once the tests pass (D-16).
3. **Facts need proof.** A claim goes in `FINDINGS.md` only with a source or a way to reproduce it. Otherwise it is an assumption.
4. **Nothing gets deleted.** Mark items superseded, rejected, dropped or answered, and say why.
5. **When a question is answered,** record the answer in `QUESTIONS.md`, then update every decision, assumption and task it affects.
6. **Keep `CLAUDE.md` short.** Add something only if every session needs it and getting it wrong would cost real work.

## Statuses

| Item | Statuses |
|---|---|
| Task | Not started, In progress, Blocked, Deferred, Done, Dropped |
| Requirement | Not met, Partial, Met |
| Decision | Proposed, Accepted, Superseded |
| Assumption | Proposed, Confirmed, Rejected |
| Question | Open, Answered |

## Rerunning the evidence

Run these from the project root. Both read directly from `MISA.zip`, so nothing needs extracting first.

```bash
python -I planning/evidence/verify_findings.py > planning/evidence/verify_findings.output.txt
python planning/evidence/smoke_test.py 2>/dev/null > planning/evidence/smoke_test.output.txt
```

The first uses `-I` to stay isolated. The second must not, because `-I` hides installed packages (F-24).

To compare the rebuilt figures with the Nov 2 dashboard, run `python -m src.pipeline`, then `python planning/evidence/reconcile_dashboard.py > planning/evidence/reconcile_dashboard.output.txt`. It also writes `reconcile_dashboard.json`, which the Word file reads.
