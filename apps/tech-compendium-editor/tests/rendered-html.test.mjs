import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function fetchWorker({ email, allowedEmails, allowedEmail } = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: {
        accept: "text/html",
        ...(email ? { "cf-access-authenticated-user-email": email } : {}),
      },
    }),
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
