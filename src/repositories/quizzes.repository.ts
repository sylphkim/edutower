import { prisma } from "../lib/prisma";
import type {
  Quiz,
  QuizDifficulty,
  QuizQuestionType
} from "../generated/prisma/client";
import type { QuizGetPayload, QuizInclude } from "../generated/prisma/models";

export interface CreateQuizQuestionRecordInput {
  type: QuizQuestionType;
  prompt: string;
  options?: string[];
  answer: string;
  explanation?: string;
  order: number;
}

export interface CreateQuizRecordInput {
  projectId: string;
  title: string;
  knowledgeNodeId: string;
  studyTaskId?: string;
  difficulty: QuizDifficulty;
  questions: CreateQuizQuestionRecordInput[];
}

const quizInclude = {
  studyTask: true,
  questions: {
    include: {
      options: {
        orderBy: {
          order: "asc"
        }
      }
    },
    orderBy: {
      order: "asc"
    }
  }
} satisfies QuizInclude;

export type QuizWithQuestions = QuizGetPayload<{
  include: typeof quizInclude;
}>;

export const quizzesRepository = {
  listByProject(projectId: string): Promise<QuizWithQuestions[]> {
    return prisma.quiz.findMany({
      where: {
        knowledgeNode: {
          projectId
        }
      },
      include: quizInclude,
      orderBy: [
        {
          createdAt: "asc"
        },
        {
          id: "asc"
        }
      ]
    });
  },

  findByIdForProject(id: string, projectId: string): Promise<QuizWithQuestions | null> {
    return prisma.quiz.findFirst({
      where: {
        id,
        knowledgeNode: {
          projectId
        }
      },
      include: quizInclude
    });
  },

  findStudyTaskForProject(id: string, projectId: string) {
    return prisma.studyTask.findFirst({
      where: {
        id,
        projectId
      }
    });
  },

  countByProject(projectId: string): Promise<number> {
    return prisma.quiz.count({
      where: {
        knowledgeNode: {
          projectId
        }
      }
    });
  },

  async create(input: CreateQuizRecordInput): Promise<QuizWithQuestions> {
    const quiz = await prisma.quiz.create({
      data: {
        title: input.title,
        knowledgeNodeId: input.knowledgeNodeId,
        studyTaskId: input.studyTaskId,
        difficulty: input.difficulty,
        questions: {
          create: input.questions.map((question) => ({
            type: question.type,
            prompt: question.prompt,
            answer: question.answer,
            explanation: question.explanation,
            order: question.order,
            options: question.options
              ? {
                  create: question.options.map((option, index) => ({
                    label: String.fromCharCode(65 + index),
                    text: option,
                    order: index
                  }))
                }
              : undefined
          }))
        }
      }
    });

    return this.findByIdForProject(
      quiz.id,
      input.projectId
    ) as unknown as Promise<QuizWithQuestions>;
  },

  deleteById(id: string): Promise<Quiz> {
    return prisma.quiz.delete({
      where: {
        id
      }
    });
  }
};
