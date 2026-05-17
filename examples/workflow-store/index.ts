import { z } from "zod";

import {
  command,
  createApiError,
  query,
  resource,
  store,
} from "@ethandm/slice";
import { createFetchHttpClient } from "@ethandm/slice/fetch";
import { createHonoResourceRoutes } from "@ethandm/slice/hono";

type Env = {
  DB: unknown;
  EMAIL_API_KEY?: string;
};

type User = {
  id: string;
  name: string;
};

type AppContext = {
  db: unknown;
  env: Env;
  user: User;
};

const ReviewQueueInputSchema = z.object({
  scope: z.enum(["mine", "team"]).default("team"),
  includeClosed: z.boolean().optional(),
  limit: z.coerce.number().optional(),
});

const ReviewQueueItemSchema = z.object({
  id: z.string(),
  recordId: z.string(),
  title: z.string(),
  dueAt: z.string().nullable(),
});

const SendReminderInputSchema = z.object({
  taskId: z.string(),
  message: z.string().optional(),
});

const SendReminderResultSchema = z.object({
  sent: z.boolean(),
  taskId: z.string(),
});

export const reviewQueueResource = resource({
  name: "reviewQueue",
  path: "/api/review-queue",
  schemas: {
    entity: ReviewQueueItemSchema,
    listInput: ReviewQueueInputSchema,
  },
  actions: {
    sendReminder: {
      method: "POST",
      path: "/:id/send-reminder",
      input: SendReminderInputSchema.omit({ taskId: true }),
      output: SendReminderResultSchema,
    },
  },
});

export const reviewStore = store({
  name: "review",
  actions: {
    queue: query({
      input: ReviewQueueInputSchema,
      output: z.array(ReviewQueueItemSchema),
      run: async ({ ctx, input }: { ctx: AppContext; input: z.input<typeof ReviewQueueInputSchema> }) => {
        return getReviewQueue(ctx.db, {
          assignedUserId: input.scope === "mine" ? ctx.user.id : null,
          includeClosed: input.includeClosed,
          limit: input.limit,
        });
      },
    }),
    sendReminder: command({
      input: SendReminderInputSchema,
      output: SendReminderResultSchema,
      run: async ({ ctx, input }: { ctx: AppContext; input: z.output<typeof SendReminderInputSchema> }) => {
        return sendReminder(ctx.env, input.taskId, {
          message: input.message,
          performedBy: ctx.user.name,
        });
      },
    }),
  },
});

export function createReviewRoutes(getUser: (context: unknown) => User) {
  return createHonoResourceRoutes(reviewQueueResource, {
    list: ({ context, input }) =>
      reviewStore.actions.queue.run({
        ctx: {
          db: context.env.DB,
          env: context.env,
          user: getUser(context),
        },
        input,
      }),
    detail: () => {
      throw createApiError({
        status: 405,
        code: "BAD_REQUEST",
        message: "Review queue items are list-only projections",
      });
    },
    create: () => {
      throw createApiError({
        status: 405,
        code: "BAD_REQUEST",
        message: "Review queue items are derived from existing records",
      });
    },
    update: () => {
      throw createApiError({
        status: 405,
        code: "BAD_REQUEST",
        message: "Review queue items are derived from existing records",
      });
    },
    delete: () => {
      throw createApiError({
        status: 405,
        code: "BAD_REQUEST",
        message: "Review queue items are derived from existing records",
      });
    },
    actions: {
      sendReminder: ({ context, id, request }) =>
        reviewStore.actions.sendReminder.run({
          ctx: {
            db: context.env.DB,
            env: context.env,
            user: getUser(context),
          },
          input: {
            taskId: String(id),
            message: request.input?.message,
          },
        }),
    },
  });
}

export const reviewClient = reviewQueueResource.client(
  createFetchHttpClient({
    headers: () => ({
      authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
    }),
  }),
);

async function getReviewQueue(
  _db: unknown,
  _input: {
    assignedUserId: string | null;
    includeClosed?: boolean;
    limit?: number;
  },
): Promise<z.output<typeof ReviewQueueItemSchema>[]> {
  return [];
}

async function sendReminder(
  _env: Env,
  taskId: string,
  _input: { message?: string; performedBy: string },
): Promise<z.output<typeof SendReminderResultSchema>> {
  return { sent: true, taskId };
}
