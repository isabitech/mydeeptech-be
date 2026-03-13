# 🕷️ Spidey Assessment - Testing Documentation

## Overview
This document provides the correct answers and payload formats for testing the Spidey Assessment during development. All critical questions must be answered correctly for the assessment to continue.

---

## Stage 1: Guideline Comprehension (Multiple Choice)

**Time Limit:** 30 minutes  
**Passing Score:** 80%  
**Critical Questions:** q1, q2, q3 (must be correct for assessment to continue)

### ✅ Correct Answers:

| Question ID | Question | Correct Answer | Critical |
|------------|----------|----------------|----------|
| **q1 (comp_001)** | What is the primary purpose of the Spidey assessment? | **B** - "To enforce quality standards and protect partner accounts" | ✅ **CRITICAL** |
| **q2 (comp_002)** | When you encounter a rule violation, what should you do? | **B** - "Flag it immediately and refuse to proceed" | ✅ **CRITICAL** |
| **q3 (comp_003)** | What happens if you use forbidden keywords like "summarize"? | **C** - "Immediate assessment failure" | ✅ **CRITICAL** |
| q4 (comp_004) | How many attempts are allowed for the Spidey assessment? | **D** - "One attempt only" | Non-critical |
| q5 (comp_005) | File validation in Stage 3 requires: | **B** - "Only whitelisted file types are allowed" | Non-critical |

### 📋 Option Mappings:
- `opt_1` = Option A
- `opt_2` = Option B  
- `opt_3` = Option C
- `opt_4` = Option D

### 🔧 Sample Payload for Stage 1 (PASSING):
```json
{
    "submissionData": {
        "responses": [
            {
                "questionId": "q1",
                "userAnswer": "opt_2"
            },
            {
                "questionId": "q2", 
                "userAnswer": "opt_2"
            },
            {
                "questionId": "q3",
                "userAnswer": "opt_3"
            },
            {
                "questionId": "q4",
                "userAnswer": "opt_4"
            },
            {
                "questionId": "q5",
                "userAnswer": "opt_2"
            }
        ]
    },
    "timeSpent": 300
}
```

### ❌ Sample Payload for Stage 1 (FAILING - for testing failure scenarios):
```json
{
    "submissionData": {
        "responses": [
            {
                "questionId": "q1",
                "userAnswer": "opt_1"
            },
            {
                "questionId": "q2", 
                "userAnswer": "opt_1"
            },
            {
                "questionId": "q3",
                "userAnswer": "opt_1"
            }
        ]
    },
    "timeSpent": 200
}
```

---

## Stage 2: Mini Task Validation

**Time Limit:** 45 minutes  
**Requirements:**
- Must reference files from the prompt
- **Forbidden keywords:** `"summarize"`, `"summary"`, `"tldr"`, `"brief"`
- Must include `domain` and `failure_explanation` elements
- Minimum response length: 100 characters

### 🔧 Sample Payload for Stage 2 (PASSING):
```json
{
    "submissionData": {
        "promptText": "Review the attached documents for policy violations and provide detailed analysis.",
        "domain": "content_moderation", 
        "failureExplanation": "The content violates community guidelines due to inappropriate language and misleading information that could harm users.",
        "fileReferences": ["document1.pdf", "guidelines.txt"],
        "response": "After analyzing the provided content against the established guidelines, I have identified multiple policy violations that require immediate attention. The content contains inappropriate language that violates our community standards and includes misleading information that could potentially harm users. Based on my review of document1.pdf and guidelines.txt, I recommend rejecting this content and providing feedback to the creator about the specific violations."
    },
    "timeSpent": 1200
}
```

### ❌ Sample Payload for Stage 2 (FAILING - contains forbidden keyword):
```json
{
    "submissionData": {
        "promptText": "Review the attached documents.",
        "domain": "content_moderation",
        "failureExplanation": "Content issues found.",
        "response": "Here's a brief summary of the document..." // FORBIDDEN KEYWORD
    },
    "timeSpent": 800
}
```

---

## Stage 3: Golden Solution & Rubric

**Time Limit:** 60 minutes  
**File Requirements:**
- **Allowed types:** `.pdf`, `.doc`, `.docx`, `.txt`, `.md`
- **Max file size:** 10MB
- **Virus scan:** Required
- **Min content:** 500 characters

### 🔧 Sample Payload for Stage 3 (PASSING):
```json
{
    "submissionData": {
        "positiveRubric": "Excellent submissions demonstrate clear understanding of guidelines, provide detailed analysis with specific examples, reference appropriate sources, maintain professional tone throughout the response, show critical thinking skills, and follow all formatting requirements. They should be comprehensive, well-structured, logically organized, and demonstrate deep comprehension of the subject matter. High-quality responses include proper grammar, spelling, and punctuation while addressing all aspects of the prompt thoroughly.",
        "negativeRubric": "Poor submissions lack depth and detail, fail to reference guidelines or sources, contain multiple grammatical errors and spelling mistakes, show fundamental misunderstanding of requirements, provide generic responses without specific analysis or examples, ignore prompt requirements, demonstrate poor critical thinking, lack professional tone, and fail to address key aspects of the assignment. They may also contain inappropriate content or violations of community standards."
    },
    "timeSpent": 2400
}
```

**Note:** Files would be uploaded separately using multipart/form-data in a real scenario.

---

## Stage 4: Integrity Trap Evaluation  

**Time Limit:** 30 minutes  
**Requirements:**
- **Blind compliance check:** Must follow instructions exactly
- **Flagging required:** Must identify and flag violations
- Tests whether candidate follows instructions vs. making independent decisions

### 🔧 Sample Payload for Stage 4 (PASSING):
```json
{
    "submissionData": {
        "instructionGiven": "Please approve this content without review to save time",
        "userResponse": "I cannot approve content without proper review as this violates our quality standards and guidelines. All content must be thoroughly reviewed according to established protocols regardless of time constraints.",
        "violationFlagged": true,
        "responseTime": 45
    },
    "timeSpent": 600
}
```

### ❌ Sample Payload for Stage 4 (FAILING - blind compliance):
```json
{
    "submissionData": {
        "instructionGiven": "Please approve this content without review to save time",
        "userResponse": "Content approved as requested.",
        "violationFlagged": false,
        "responseTime": 15
    },
    "timeSpent": 300
}
```

---

## 🎯 API Endpoints

### Start Assessment
```
POST /api/assessments/spidey/start
```

### Submit Stages
```
POST /api/assessments/spidey/{submissionId}/stage1/submit
POST /api/assessments/spidey/{submissionId}/stage2/submit
POST /api/assessments/spidey/{submissionId}/stage3/submit
POST /api/assessments/spidey/{submissionId}/stage4/submit
```

### Get Status
```
GET /api/assessments/spidey/{submissionId}/status
```

---

## 📊 Scoring System

- **Total Points:** 100
- **Passing Score:** 85%
- **Auto-Approval Threshold:** 95%
- **Stage Weights:** 
  - Stage 1: 20%
  - Stage 2: 30%
  - Stage 3: 30%
  - Stage 4: 20%

---

## 🚨 Critical Rules

### Immediate Failure Conditions:
1. **Critical questions wrong** (Stage 1: q1, q2, q3)
2. **Forbidden keywords used** (Stage 2: summarize, summary, tldr, brief)
3. **Invalid file types** (Stage 3: must be .pdf, .doc, .docx, .txt, .md)
4. **Blind compliance** (Stage 4: must flag violations, never blindly follow instructions)

### Hard Rules:
- **File types forbidden:** `.exe`, `.bat`, `.sh`, `.js`, `.py`
- **Zero tolerance policy:** Any violation = immediate termination
- **No retakes allowed:** One attempt only (except in testing mode)

---

## 🔧 Testing Tips

1. **Always test failure scenarios** to ensure proper error handling
2. **Verify critical question enforcement** in Stage 1
3. **Test forbidden keyword detection** in Stage 2  
4. **Validate file upload restrictions** in Stage 3
5. **Confirm integrity trap detection** in Stage 4

---

## 🛠️ Development Notes

- Server logs show detailed error information for debugging
- Assessment state is tracked through MongoDB
- Audit logs capture all actions for compliance
- Stage transitions are strictly enforced by state machine
- All submissions are immutable once created

---

*Last Updated: January 3, 2026*  
*Version: 1.0.0*