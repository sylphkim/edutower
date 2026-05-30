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
- Express-to-FastAPI AI Engine bridge through `/api/ai/chat`

## Phase 2.5: Mainline Alignment

Current architecture decision:

- Express is the main backend and product-flow owner.
- FastAPI is the AI Engine and owns Agent/model execution.
- Frontend should prefer Express endpoints. Current `/chat` is kept as a compatibility adapter for the static UI.

## Phase 3: Replace Stubs Incrementally

Recommended order:

1. Materials: add real upload parsing and chunking.
2. Skills: extract knowledge points from chunks.
3. Plan: generate a plan from learner goal, time budget, and knowledge gaps.
4. Quiz: generate and submit quizzes from knowledge points.
5. Wrongbook: persist incorrect answers and review state.
6. Memory: persist learner profile and update it from study events.

Each module should keep the public route shape stable while replacing mock service internals.
