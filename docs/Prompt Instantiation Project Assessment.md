Prompt Instantiation Project Assessment backened
# Spidey Assessment Backend Implementation Guide

**Audience:** Backend Team Lead & BE Engineers
**Stack:** Node.js (TypeScript recommended), REST API
**Author Voice:** CTO, MyDeepTech

---

## 1. Backend Mission Statement

This backend is a **quality enforcement engine**, not just an API.

Its job is to:

* Enforce strict assessment rules
* Protect partner accounts
* Prevent invalid or risky candidates from passing

The backend is the **final authority**.

---

## 2. Core Backend Principles

1. **Zero Trust** – Assume all inputs are hostile
2. **Server Authority** – Frontend never decides pass/fail
3. **Fail Hard** – Any rule violation = immediate fail
4. **Auditability** – Every decision must be traceable

---

## 3. Data Models (High-Level)

### Candidate

* id
* status (active, failed, passed)
* current_stage
* timestamps per stage

### Submission

* candidate_id
* stage
* payload (JSON)
* files (metadata + storage refs)
* validation_result

### Evaluation

* score
* rule_violations
* reviewer_notes (optional)

---

## 4. Stage Engine Architecture

Implement assessment as a **state machine**.

Valid transitions only:

* Stage 1 → Stage 2
* Stage 2 → Stage 3
* Stage 3 → Stage 4
* Stage 4 → Completed

Any invalid transition = rejection.

---

## 5. Stage 1 – Guideline Comprehension Logic

### Backend Responsibilities

* Validate quiz answers
* Enforce time limits
* Auto-fail on critical mistakes

### Output

* Pass → unlock Stage 2
* Fail → assessment terminated

---

## 6. Stage 2 – Mini Task Validation

### Required Validations

* Prompt references provided files
* Domain is valid
* Failure explanation is logical and specific
* No forbidden instructions present

### Automated Checks

* Keyword scans (e.g. "summarize")
* File dependency checks

---

## 7. Stage 3 – Golden Solution & Rubric Validation

### File Validation Rules

* File type whitelist only
* File size limits enforced
* Minimum content length

### Rubric Validation

* Positive rubric present
* Negative rubric present
* Rubrics are testable (not vague)

Any missing element = fail.

---

## 8. Stage 4 – Integrity Trap Evaluation

### Backend Goal

Detect blind compliance.

### Logic

* Identify if candidate proceeded with invalid instruction
* Check if violation was flagged

### Outcomes

* Flagged → pass
* Complied blindly → fail

---

## 9. Scoring & Decision Engine

### Hard Rules

* Any forbidden file = fail
* Any hallucinated data = fail
* Any rule violation = fail

### Weighted Scoring

Used **only after** hard rules pass.

---

## 10. Storage & Security

* Files stored with immutable hashes
* Virus scan uploads
* No public file URLs

---

## 11. Frontend Communication Contract

Backend must:

* Return structured error codes
* Provide human-readable failure reasons
* Never expose internal scoring logic

---

## 12. Admin & Review Tools

Internal dashboards must show:

* Stage failures
* Common violation patterns
* Time-to-fail metrics

These insights protect MyDeepTech long-term.

---

## 13. Final Backend Success Criteria

The backend succeeds if:

* Passing candidates are rare
* Partner risk is minimized
* Every decision is defensible

If reviewers trust the system, the system is correct.

---

**End of Backend Guide**


🔹 Global Context Addendum
(Applies to Frontend & Backend)
Project Name

Prompt Instantiation Project

Assessment Codename

Spidey High-Discipline Assessment

0. System Context (Read This First)

This Spidey assessment is not a standalone system.

It is a high-risk, high-discipline assessment module that must be integrated into the existing Prompt Instantiation Project, which already contains multiple assessments with shared infrastructure.

This has serious architectural implications.

1. Non-Negotiable Integration Rules
1.1 No Parallel Systems

❌ No separate auth

❌ No separate user model

❌ No duplicate assessment engines

This assessment must plug into existing:

Authentication

Candidate identity

Assessment routing

Submission pipelines

Admin review flows

1.2 Assessment-as-a-Module Model

Spidey must be implemented as:

One assessment definition inside a shared assessment framework

Not:

A new app

A custom one-off flow

A special-case bypass

If the Prompt Instantiation Project supports:

assessmentId

assessmentType

stageConfig

👉 Spidey must conform to that pattern.

2. Why This Assessment Is Different (But Still Must Conform)

Spidey is stricter, not structurally different.

Key differences:

More stages

Harder validation

Automatic hard-fails

File-heavy workflows

Integrity traps

But it must still:

Use shared routing

Use shared persistence

Respect global assessment lifecycle rules

This prevents tech debt and future breakage.

3. Frontend Integration Expectations

Frontend engineers must:

Register Spidey as a new assessment entry

Use existing layout shells

Reuse form components where possible

Add new validation layers, not new form logic

Example mindset:

“This is the strictest assessment in the system — not a special system.”

4. Backend Integration Expectations

Backend engineers must:

Register Spidey in the assessment registry

Plug into existing submission + review pipelines

Use existing candidate records

Extend validation rules, not bypass them

Any logic that can be generalized later should be.

Spidey will likely become the template for future high-quality projects.

5. Versioning & Safety

Because this is inside a live repo:

All changes must be feature-flagged

Spidey must be deployable without affecting other assessments

Rollback must be trivial

Breaking other assessments is unacceptable.