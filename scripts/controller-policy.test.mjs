import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflows = ['.github/workflows/autonomous-controller.yml'];
for (const filename of workflows) {
  const workflow = readFileSync(filename, 'utf8');
  const source = workflow.split('          script: |\n')[1].split(/\n      - /)[0]
    .split('\n').map((line) => line.slice(12)).join('\n');
  const run = new (Object.getPrototypeOf(async function () {}).constructor)('github', 'context', 'core', source);
  for (const [name, patch, runSha, allowed] of [
    ['current successful commit', {}, 'current', true],
    ['stale CI run', {}, 'old', false],
    ['draft pull request', { draft: true }, 'current', false],
    ['closed pull request', { state: 'closed' }, 'current', false],
    ['foreign repository', { head: { sha: 'current', ref: 'branch', repo: { full_name: 'other/repo' } } }, 'current', false],
    ['missing authorization label', { labels: [] }, 'current', false],
  ]) {
    test(`${filename}: ${name}`, async () => {
      const outputs = {};
      const pr = { state: 'open', draft: false, labels: [{ name: 'autonomy:auto' }], head: { sha: 'current', ref: 'branch', repo: { full_name: 'owner/repo' } }, ...patch };
      await run({ rest: { pulls: { get: async () => ({ data: pr }) }, issues: { listComments: () => {} } }, paginate: async () => [] },
        { repo: { owner: 'owner', repo: 'repo' }, payload: { workflow_run: { head_sha: runSha } } },
        { setOutput: (key, value) => { outputs[key] = value; } });
      assert.equal(outputs.repairable ?? outputs.eligible, String(allowed));
    });
  }
}
