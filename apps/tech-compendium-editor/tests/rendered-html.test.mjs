import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function fetchWorker({ email, allowedEmails, allowedEmail, path = "/", init = {} } = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}`);
  const { default: worker } = await import(workerUrl.href);

  const headers = new Headers(init.headers);
  headers.set("accept", headers.get("accept") ?? "text/html");
  if (email) headers.set("cf-access-authenticated-user-email", email);

  return worker.fetch(
    new Request(`http://localhost${path}`, { ...init, headers }),
    {
      ALLOWED_EMAILS: allowedEmails,
      ALLOWED_EMAIL: allowedEmail,
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("allows video-sized multipart requests to reach the media route", async () => {
  const form = new FormData();
  form.set("video", new File([new Uint8Array(2 * 1024 * 1024)], "clip.mp4", { type: "video/mp4" }));
  form.set("blockId", "test-video");

  const response = await fetchWorker({
    email: "owner@example.com",
    allowedEmails: "owner@example.com",
    path: "/api/media",
    init: { method: "POST", body: form },
  });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "The GitHub publishing secret is not configured." });
});

test("renders development preview metadata for an allowed editor", async () => {
  const response = await fetchWorker({
    email: "friend@example.com",
    allowedEmails: "owner@example.com,friend@example.com",
  });

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("normalizes comma-separated editor emails", async () => {
  const response = await fetchWorker({
    email: "FRIEND@EXAMPLE.COM",
    allowedEmails: " owner@example.com, Friend@Example.com ",
  });

  assert.equal(response.status, 200);
});

test("keeps the legacy single-email setting working", async () => {
  const response = await fetchWorker({
    email: "owner@example.com",
    allowedEmail: "owner@example.com",
  });

  assert.equal(response.status, 200);
});

test("rejects missing and unlisted editor identities", async () => {
  const [missingIdentity, unlistedIdentity] = await Promise.all([
    fetchWorker({ allowedEmails: "owner@example.com,friend@example.com" }),
    fetchWorker({
      email: "outsider@example.com",
      allowedEmails: "owner@example.com,friend@example.com",
    }),
  ]);

  assert.equal(missingIdentity.status, 403);
  assert.equal(unlistedIdentity.status, 403);
});
