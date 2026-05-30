# API Contract

EduTower currently exposes an Express backend API. Express is the product-facing backend and delegates Agent/model execution to the FastAPI AI Engine. Most product modules are scaffolded with mock data so frontend and later business logic can integrate against stable paths early.

## Response Shape

Success:

```json
{
  "ok": true,
  "data": {}
}
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Route not found."
  }
}
```

Scaffolded module responses include:

```json
{
  "ok": true,
  "data": {
    "meta": {
      "module": "plan.generate",
      "status": "mock",
      "message": "Study plan generation is scaffolded only."
    },
    "result": {}
  }
}
```

## Stable Endpoints

| Method | Path | Status | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | ready | Service health check |
| POST | `/api/ai/chat` | ready | Product-facing chat endpoint that calls FastAPI AI Engine `/chat` |
| POST | `/chat` | ready | Legacy static frontend compatibility endpoint that returns `{ reply }` |
| POST | `/api/llm/chat` | ready | Low-level generic LLM chat endpoint for provider testing |
| POST | `/api/llm/generate` | ready | Low-level generic text generation endpoint for provider testing |
| POST | `/api/materials/upload` | mock | Material upload placeholder |
| GET | `/api/materials/chunks` | mock | Material chunk placeholder |
| POST | `/api/plan/generate` | mock | Study plan generation placeholder |
| GET | `/api/skills/tree` | mock | Skill tree placeholder |
| POST | `/api/quiz/generate` | mock | Quiz generation placeholder |
| POST | `/api/quiz/submit` | mock | Quiz submission placeholder |
| GET | `/api/wrongbook` | mock | Wrongbook list placeholder |
| GET | `/api/memory/profile` | mock | Learner memory profile placeholder |
| POST | `/api/memory/update` | mock | Learner memory update placeholder |

## Current Boundary

The project does not yet implement real file parsing, RAG, vector storage, plan generation, quiz grading, wrongbook persistence, or long-term memory persistence. Product flow should enter through Express; FastAPI remains the AI Engine boundary.
