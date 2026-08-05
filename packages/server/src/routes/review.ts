import { Hono } from "hono";
import {
  listRemotes,
  listPullRequests,
  describeGhError,
} from "../review/github.js";
import { ReviewRunner } from "../review/runner.js";
import { defaultReviewModels, resolveModel } from "../ai/models.js";

export function reviewRoutes(projectRoot: string) {
  const app = new Hono();
  const runner = new ReviewRunner(projectRoot);

  // GET /api/review/remotes — git remotes of the project syl is pointed at
  app.get("/remotes", async (c) => {
    try {
      const remotes = await listRemotes(projectRoot);
      return c.json({ remotes, defaults: await defaultReviewModels() });
    } catch (e) {
      return c.json({ error: describeGhError(e) }, 500);
    }
  });

  // GET /api/review/prs?repo=owner/name — recent PRs, for the picker
  app.get("/prs", async (c) => {
    const repo = c.req.query("repo");
    if (!repo) return c.json({ error: "repo is required" }, 400);
    try {
      const pullRequests = await listPullRequests(repo, projectRoot);
      return c.json({ pullRequests });
    } catch (e) {
      return c.json({ error: describeGhError(e) }, 500);
    }
  });

  // POST /api/review — kick off a scout + reviewer run
  app.post("/", async (c) => {
    const body = await c.req.json<{
      remote?: string;
      repo?: string;
      number?: number;
      scoutModel?: string;
      reviewerModel?: string;
    }>();

    const number = Number(body.number);
    if (!body.repo || !Number.isInteger(number) || number <= 0) {
      return c.json({ error: "repo and a positive PR number are required" }, 400);
    }

    const defaults = await defaultReviewModels();
    const scoutModel = body.scoutModel ?? defaults.scout;
    const reviewerModel = body.reviewerModel ?? defaults.reviewer;

    if (!scoutModel || !reviewerModel) {
      return c.json(
        { error: "No model is available — set ANTHROPIC_API_KEY or OPENAI_API_KEY." },
        400
      );
    }
    for (const model of [scoutModel, reviewerModel]) {
      if (!resolveModel(model)) {
        return c.json({ error: `Unknown model "${model}"` }, 400);
      }
    }

    const run = runner.start({
      remote: body.remote ?? "origin",
      repo: body.repo,
      number,
      scoutModel,
      reviewerModel,
    });

    return c.json({ id: run.id });
  });

  // GET /api/review/runs — every run this session (without diffs)
  app.get("/runs", (c) => c.json({ runs: runner.list() }));

  // GET /api/review/:id — full run, including the diff once fetched
  app.get("/:id", (c) => {
    const run = runner.get(c.req.param("id"));
    if (!run) return c.json({ error: "run not found" }, 404);
    return c.json({ run });
  });

  return app;
}
