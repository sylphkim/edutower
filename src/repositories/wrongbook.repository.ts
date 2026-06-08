import { prisma } from "../lib/prisma";
import type {
  QuizQuestionType,
  WrongbookItem,
  WrongbookStatus
} from "../generated/prisma/client";

export interface CreateWrongbookRecordInput {
  userId: string;
  projectId?: string;
  knowledgeNodeId?: string;
  quizQuestionId?: string;
  quizAttemptId?: string;
  questionType: QuizQuestionType;
  questionPrompt: string;
  correctAnswer: string;
  explanation?: string;
  wrongAnswer: string;
  subject: string;
  category: string;
  reviewCount?: number;
  lastReviewedAt?: Date;
  status?: WrongbookStatus;
  correctedAt?: Date | null;
}

export interface UpdateWrongbookRecordInput {
  questionType?: QuizQuestionType;
  questionPrompt?: string;
  correctAnswer?: string;
  explanation?: string | null;
  wrongAnswer?: string;
  subject?: string;
  category?: string;
  reviewCount?: number;
  lastReviewedAt?: Date | null;
  status?: WrongbookStatus;
  correctedAt?: Date | null;
}

export interface QuizSubmissionQuestionInput {
  questionId: string;
  questionType: QuizQuestionType;
  questionPrompt: string;
  correctAnswer: string;
  explanation?: string;
  userAnswer: string;
  isCorrect: boolean;
}

export interface RecordQuizSubmissionInput {
  userId: string;
  projectId: string;
  knowledgeNodeId: string;
  questions: QuizSubmissionQuestionInput[];
}

export const wrongbookRepository = {
  listActiveByUser(userId: string): Promise<WrongbookItem[]> {
    return prisma.wrongbookItem.findMany({
      where: {
        userId,
        deletedAt: null
      },
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

  findActiveByIdForUser(id: string, userId: string): Promise<WrongbookItem | null> {
    return prisma.wrongbookItem.findFirst({
      where: {
        id,
        userId,
        deletedAt: null
      }
    });
  },

  create(input: CreateWrongbookRecordInput): Promise<WrongbookItem> {
    return prisma.wrongbookItem.create({
      data: {
        userId: input.userId,
        projectId: input.projectId,
        knowledgeNodeId: input.knowledgeNodeId,
        quizQuestionId: input.quizQuestionId,
        quizAttemptId: input.quizAttemptId,
        questionType: input.questionType,
        questionPrompt: input.questionPrompt,
        correctAnswer: input.correctAnswer,
        explanation: input.explanation,
        wrongAnswer: input.wrongAnswer,
        subject: input.subject,
        category: input.category,
        reviewCount: input.reviewCount,
        lastReviewedAt: input.lastReviewedAt,
        status: input.status,
        correctedAt: input.correctedAt
      }
    });
  },

  updateByIdForUser(
    id: string,
    userId: string,
    input: UpdateWrongbookRecordInput
  ): Promise<WrongbookItem> {
    return prisma.wrongbookItem.update({
      where: {
        id,
        userId
      },
      data: input
    });
  },

  softDeleteByIdForUser(id: string, userId: string): Promise<WrongbookItem> {
    return prisma.wrongbookItem.update({
      where: {
        id,
        userId
      },
      data: {
        deletedAt: new Date()
      }
    });
  },

  async reassignSubjectForUser(
    userId: string,
    subject: string,
    nextSubject: string
  ): Promise<number> {
    const result = await prisma.wrongbookItem.updateMany({
      where: {
        userId,
        subject,
        deletedAt: null
      },
      data: {
        subject: nextSubject
      }
    });

    return result.count;
  },

  async reassignCategoryForUser(
    userId: string,
    category: string,
    nextCategory: string
  ): Promise<number> {
    const result = await prisma.wrongbookItem.updateMany({
      where: {
        userId,
        category,
        deletedAt: null
      },
      data: {
        category: nextCategory
      }
    });

    return result.count;
  },

  async recordQuizSubmission(input: RecordQuizSubmissionInput): Promise<void> {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      for (const question of input.questions) {
        const attempt = await tx.quizAttempt.create({
          data: {
            questionId: question.questionId,
            userAnswer: question.userAnswer,
            isCorrect: question.isCorrect
          }
        });

        const activeItems = await tx.wrongbookItem.findMany({
          where: {
            userId: input.userId,
            quizQuestionId: question.questionId,
            deletedAt: null
          },
          orderBy: [
            {
              createdAt: "asc"
            },
            {
              id: "asc"
            }
          ]
        });
        const [existingItem, ...duplicateItems] = activeItems;

        if (duplicateItems.length > 0) {
          await tx.wrongbookItem.updateMany({
            where: {
              id: {
                in: duplicateItems.map((item) => item.id)
              }
            },
            data: {
              deletedAt: now
            }
          });
        }

        if (question.isCorrect) {
          if (existingItem) {
            await tx.wrongbookItem.update({
              where: {
                id: existingItem.id
              },
              data: {
                quizAttemptId: attempt.id,
                status: "corrected",
                correctedAt: now
              }
            });
          }

          continue;
        }

        if (existingItem) {
          await tx.wrongbookItem.update({
            where: {
              id: existingItem.id
            },
            data: {
              projectId: input.projectId,
              knowledgeNodeId: input.knowledgeNodeId,
              quizAttemptId: attempt.id,
              questionType: question.questionType,
              questionPrompt: question.questionPrompt,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
              wrongAnswer: question.userAnswer,
              status: "uncorrected",
              correctedAt: null
            }
          });

          continue;
        }

        await tx.wrongbookItem.create({
          data: {
            userId: input.userId,
            projectId: input.projectId,
            knowledgeNodeId: input.knowledgeNodeId,
            quizQuestionId: question.questionId,
            quizAttemptId: attempt.id,
            questionType: question.questionType,
            questionPrompt: question.questionPrompt,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            wrongAnswer: question.userAnswer,
            subject: "uncategorized",
            category: "uncategorized",
            status: "uncorrected"
          }
        });
      }
    });
  }
};
