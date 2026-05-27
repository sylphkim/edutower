# Module Split

The codebase keeps the existing Express layering and adds EduTower product modules around it.

## Existing Foundation

| Area | Files | Responsibility |
| --- | --- | --- |
| App bootstrap | `src/server.ts`, `src/app.ts` | Start Express and mount API routes |
| Environment | `src/config/env.ts` | Read LLM and server configuration |
| LLM | `src/services/llm.service.ts`, `src/controllers/llm.controller.ts`, `src/routes/llm.routes.ts` | Generic OpenAI-compatible provider integration |
| Utilities | `src/utils/*` | Response formatting, errors, logging |

## EduTower Product Modules

| Module | Route | Controller | Service | Mock |
| --- | --- | --- | --- | --- |
| AI facade | `src/routes/ai.routes.ts` | `src/controllers/llm.controller.ts` | `src/services/llm.service.ts` | none |
| Materials | `src/routes/materials.routes.ts` | `src/controllers/materials.controller.ts` | `src/services/materials.service.ts` | `src/mock/materials.ts` |
| Plan | `src/routes/plan.routes.ts` | `src/controllers/plan.controller.ts` | `src/services/plan.service.ts` | `src/mock/plan.ts` |
| Skills | `src/routes/skills.routes.ts` | `src/controllers/skills.controller.ts` | `src/services/skills.service.ts` | `src/mock/knowledgePoints.ts` |
| Quiz | `src/routes/quiz.routes.ts` | `src/controllers/quiz.controller.ts` | `src/services/quiz.service.ts` | `src/mock/quiz.ts` |
| Wrongbook | `src/routes/wrongbook.routes.ts` | `src/controllers/wrongbook.controller.ts` | `src/services/wrongbook.service.ts` | `src/mock/wrongbook.ts` |
| Memory | `src/routes/memory.routes.ts` | `src/controllers/memory.controller.ts` | `src/services/memory.service.ts` | `src/mock/memory.ts` |

## Type Ownership

Shared product contracts live in `src/types/edutower.ts`. LLM provider contracts remain in `src/types/llm.ts`.

## Rule of Thumb

Keep provider logic generic in `LLMService`. Product-specific prompts, schemas, persistence, and orchestration should live in their own module services when those features are implemented.
