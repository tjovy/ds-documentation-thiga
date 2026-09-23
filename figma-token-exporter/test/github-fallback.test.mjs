import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

test('relays a blocked main-thread GitHub request through the plugin UI', async () => {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.networkAccess.allowedDomains, ['https://api.github.com/']);
  assert.deepEqual(manifest.networkAccess.devAllowedDomains, ['https://api.github.com/']);

  let onmessage;
  const sentMessages = [];
  const context = {
    __html__: '',
    Promise,
    Map,
    JSON,
    Date,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    setTimeout,
    clearTimeout,
    figma: {
      showUI() {},
      ui: {
        postMessage(message) {
          sentMessages.push(message);
        },
        set onmessage(handler) {
          onmessage = handler;
        },
      },
      clientStorage: {
        getAsync: async () => undefined,
        setAsync: async () => {},
      },
      root: { name: 'Test Thiga' },
      base64Encode: () => '',
      base64Decode: () => new Uint8Array(),
    },
    fetch: async () => {
      throw new Error('Failed to fetch');
    },
  };
  context.globalThis = context;

  const bundle = readFileSync(new URL('../dist/code.js', import.meta.url), 'utf8').replace(
    'initialize().catch',
    'globalThis.__githubRequest = githubRequest;\n  initialize().catch',
  );
  assert.doesNotMatch(bundle, /\/dispatches/);
  vm.runInNewContext(bundle, context);

  const requestPromise = context.__githubRequest(
    'https://api.github.com/repos/tjovy/ds-documentation-thiga/git/ref/heads/main',
    'test-token',
  );
  await new Promise((resolve) => setImmediate(resolve));

  const request = sentMessages.find((message) => message.type === 'github-request');
  assert.ok(request, 'the UI relay receives the failed main-thread request');
  assert.equal(request.headers.Authorization, 'Bearer test-token');
  assert.equal(request.headers['X-GitHub-Api-Version'], '2022-11-28');
  assert.equal(request.headers['Cache-Control'], undefined, 'GitHub CORS does not allow Cache-Control');

  await onmessage({
    type: 'github-response',
    requestId: request.requestId,
    ok: true,
    status: 200,
    body: '{"ok":true}',
  });

  const response = await requestPromise;
  assert.equal(response.ok, true);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });

  const unauthenticatedRequestPromise = context.__githubRequest(
    'https://api.github.com/repos/tjovy/ds-documentation-thiga/git/ref/heads/main',
  );
  await new Promise((resolve) => setImmediate(resolve));
  const unauthenticatedRequest = sentMessages.filter((message) => message.type === 'github-request').at(-1);
  assert.equal(unauthenticatedRequest.headers.Authorization, undefined);
  await onmessage({
    type: 'github-response',
    requestId: unauthenticatedRequest.requestId,
    ok: true,
    status: 200,
    body: '{"ok":true}',
  });
  assert.equal((await unauthenticatedRequestPromise).ok, true);
});
