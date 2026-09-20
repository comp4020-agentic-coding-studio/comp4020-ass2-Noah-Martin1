import { defineCollection, reference } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { courseNodeSchema } from "astro-course-university/schemas";

const weekSchema = z.coerce.number().int().min(1).max(12);
/**
 * The template's own sample entries, excluded per collection.
 *
 * These files ship with the starter and this course replaced every one of
 * them. They are gitignored and untracked, and on this machine they keep
 * reappearing on disk with their original mtimes -- something outside the repo
 * restores them. When they do, `lectures/week-01.md` and `lectures/week-01.mdx`
 * collide on the slug `week-01`, the loader silently picks one, and the dev
 * server serves "Week 1: Opening lecture" with none of the course on it. That
 * is a very quiet failure: the build still passes, and the only symptom is a
 * warning in a log nobody reads while the site shows the wrong page.
 *
 * Excluding them makes the collision impossible rather than merely unlikely.
 *
 * Per collection, not globally: `sessions/week-01.md` and `sessions/week-02.md`
 * are real course content with the same basenames as the starter lectures, and
 * one shared exclusion list deleted them from the build. Lectures are stated as
 * a rule -- every lecture in this course is .mdx, because every one of them
 * imports components -- and the other three name their two samples.
 */
const STARTER_SAMPLES: Record<string, string[]> = {
  lectures: ["!**/*.md"],
  sessions: ["!01-getting-started.md", "!02-first-review.md"],
  assessments: ["!assignment-1.md", "!final-project.md"],
  people: ["!idris-fenn.md", "!marisol-quaye.md"],
};

const courseNodeLoader = (dir: string) =>
  glob({
    pattern: ["**/*.{md,mdx}", "!**/CLAUDE.md", ...(STARTER_SAMPLES[dir] ?? [])],
    base: `src/content/${dir}`,
  });

const teacherRefs = z.array(reference("people")).min(1);

const weightedMarking = z
  .object({
    mode: z.literal("weighted"),
    criteria: z
      .array(z.object({ name: z.string().trim().min(1), weight: z.number().positive() }))
      .min(1),
  })
  .superRefine((marking, ctx) => {
    const total = marking.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    if (total !== 100) {
      ctx.addIssue({
        code: "custom",
        path: ["criteria"],
        message: `criterion weights sum to ${total}, not 100`,
      });
    }
  });

const holisticMarking = z.object({
  mode: z.literal("holistic"),
  description: z.string().trim().min(40),
});

export const collections = {
  sessions: defineCollection({
    loader: courseNodeLoader("sessions"),
    schema: courseNodeSchema
      .extend({
        week: weekSchema,
        date: z.coerce.date(),
        teachers: teacherRefs.optional(),
      })
      .loose(),
  }),

  assessments: defineCollection({
    loader: courseNodeLoader("assessments"),
    schema: courseNodeSchema
      .extend({
        week: weekSchema,
        due: z.coerce.date(),
        weight: z.coerce.number().positive().max(100),
        marking: z.discriminatedUnion("mode", [weightedMarking, holisticMarking]).optional(),
        // True for a component that is graded continuously rather than handed
        // in once -- currently only the weekly quizzes. `due` still anchors it
        // to a week (so the "falls due in a week already taught" check and the
        // grid's sort keep working), but it reads as "from", not "due", and it
        // is left out of the arc timeline's per-week deadline chips, which
        // exist to show single-week hand-ins.
        ongoing: z.coerce.boolean().default(false),
      })
      .loose(),
  }),

  lectures: defineCollection({
    loader: courseNodeLoader("lectures"),
    schema: courseNodeSchema
      .extend({
        week: weekSchema,
        date: z.coerce.date(),
        teachers: teacherRefs.optional(),
        slides: z
          .string()
          .regex(/^\/decks\/[a-z0-9-]+\/$/)
          .optional(),
      })
      .loose(),
  }),

  people: defineCollection({
    loader: courseNodeLoader("people"),
    schema: ({ image }) =>
      z
        .object({
          title: z.string().trim().min(1),
          description: z.string().trim().min(40),
          role: z.string().trim().min(1),
          contact: z.string().trim().min(1).optional(),
          affiliation: z.string().trim().min(1).optional(),
          email: z.email().optional(),
          url: z.url().optional(),
          photo: image().optional(),
          photoAlt: z.string().trim().optional(),
          published: z.coerce.boolean().default(true),
        })
        .superRefine((person, ctx) => {
          if (person.photo && !person.photoAlt) {
            ctx.addIssue({
              code: "custom",
              path: ["photoAlt"],
              message: "describe the photo when one is supplied",
            });
          }
        }),
  }),
};
