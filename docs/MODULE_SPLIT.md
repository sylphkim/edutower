# Module Split

The codebase uses Express as the product-facing backend and FastAPI as the AI Engine. Express owns API contracts, product flow, module routing, and static page hosting. FastAPI owns Agent/model execution behind the `/chat` engine endpoint.

## Existing Foundation

| Area | Files | Responsibility |
| --- | --- | --- |
| App bootstrap | `src/server.ts`, `src/app.ts` | Start Express and mount API routes |
| Environment | `src/config/env.ts` | Read Express, AI Engine, and LLM provider configuration |
| AI Engine bridge | `src/services/aiEngine.service.ts`, `src/controllers/ai.controller.ts`, `src/routes/ai.routes.ts` | Product-facing chat bridge from Express to FastAPI |
| LLM | `src/services/llm.service.ts`, `src/controllers/llm.controller.ts`, `src/routes/llm.routes.ts` | Low-level generic OpenAI-compatible provider integration |
| Utilities | `src/utils/*` | Response formatting, errors, logging |

## EduTower Product Modules

| Module | Route | Controller | Service | Mock |
| --- | --- | --- | --- | --- |
| AI facade | `src/routes/ai.routes.ts` | `src/controllers/ai.controller.ts` | `src/services/aiEngine.service.ts` | none |
| Materials | `src/routes/materials.routes.ts` | `src/controllers/materials.controller.ts` | `src/services/materials.service.ts` | `src/mock/materials.ts` |
| Plan | `src/routes/plan.routes.ts` | `src/controllers/plan.controller.ts` | `src/services/plan.service.ts` | `src/mock/plan.ts` |
| Skills | `src/routes/skills.routes.ts` | `src/controllers/skills.controller.ts` | `src/services/skills.service.ts` | `src/mock/knowledgePoints.ts` |
| Quiz | `src/routes/quiz.routes.ts` | `src/controllers/quiz.controller.ts` | `src/services/quiz.service.ts` | `src/mock/quiz.ts` |
| Wrongbook | `src/routes/wrongbook.routes.ts` | `src/controllers/wrongbook.controller.ts` | `src/services/wrongbook.service.ts` | `src/mock/wrongbook.ts` |
| Memory | `src/routes/memory.routes.ts` | `src/controllers/memory.controller.ts` | `src/services/memory.service.ts` | `src/mock/memory.ts` |

## Type Ownership

Shared product contracts live in `src/types/edutower.ts`. LLM provider contracts remain in `src/types/llm.ts`. FastAPI engine request/response compatibility is isolated in `src/services/aiEngine.service.ts`.

## Rule of Thumb

Keep provider logic generic in `LLMService`. Product flow should go through Express controllers/services. Agent/model orchestration should sit behind FastAPI AI Engine or in a future dedicated bridge service, not inside route files.
