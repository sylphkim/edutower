# Development Flow

## Phase 1: Backend Foundation

Completed:

- Express + TypeScript server
- Environment configuration
- Unified success/error response format
- Generic OpenAI-compatible LLM service
- `/api/health`, `/api/llm/chat`, `/api/llm/generate`

## Phase 2: EduTower Scaffold

Completed in this scaffold:

- Product-facing route groups
- Domain types
- Mock data
- Placeholder module services and controllers
- API contract documentation

## Phase 3: Replace Stubs Incrementally

Recommended order:

1. Materials: add real upload parsing and chunking.
2. Skills: extract knowledge points from chunks.
3. Plan: generate a plan from learner goal, time budget, and knowledge gaps.
4. Quiz: generate and submit quizzes from knowledge points.
5. Wrongbook: persist incorrect answers and review state.
6. Memory: persist learner profile and update it from study events.

Each module should keep the public route shape stable while replacing mock service internals.
