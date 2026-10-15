import test from 'node:test';
import assert from 'node:assert/strict';
import reconcile from '../.github/scripts/automatic-delivery.cjs';
const { personal, protectedForCI, latestPreview } = reconcile;

const fullName = 'BWCbewchan/tpsmindx';
const policy = { required_status_checks: { strict: true, contexts: ['CI'] }, enforce_admins: { enabled: true } };
const deployment = (extra = {}) => ({ projectId: 'prj_test', readyState: 'READY', target: null, createdAt: 1,
  meta: { githubCommitSha: 'head', githubCommitRef: 'preview', githubCommitOrg: 'BWCbewchan', githubCommitRepo: 'tpsmindx' }, ...extra });

function fixture(options = {}) {
  const calls = [], errors = [], notes = [];
  const release = options.release;
  const pr = { number: 1, state: 'open', draft: false, mergeable: true, labels: [{ name: 'auto-delivery' }],
    head: { ref: release ? 'preview' : 'kydai', sha: 'head', repo: { full_name: fullName } },
    base: { ref: release ? 'main' : 'preview', sha: 'base' }, ...options.pr };
  const endpoint = (name, response) => async args => { calls.push([name, args]); return { data: typeof response === 'function' ? response(args) : response }; };
  let reads = 0;
  const github = {
    rest: {
      pulls: {
        list: 'listPRs',
        get: endpoint('getPR', () => (++reads > 1 && options.fresh ? options.fresh(pr) : pr)),
        create: endpoint('createPR', { ...pr, number: 2, labels: [] }),
        updateBranch: endpoint('updateBranch', {}),
        merge: endpoint('merge', { merged: options.mergeAccepted !== false }),
      },
      repos: {
        getBranch: endpoint('branch', ({ branch }) => ({ commit: { sha: branch === pr.base.ref ? 'base' : 'head' } })),
        getBranchProtection: endpoint('protection', options.policy || policy),
        merge: endpoint('syncMerge', {}),
        compareCommitsWithBasehead: endpoint('compare', { behind_by: options.behind || 0, ahead_by: 1, files: options.files || [{ filename: 'app/page.tsx' }] }),
      },
      git: { getRef: endpoint('getRef', { object: { sha: 'head' } }), createRef: endpoint('createRef', {}) },
      actions: { listWorkflowRuns: endpoint('ci', { workflow_runs: options.runs || [{ id: 10, path: '.github/workflows/ci.yml', head_sha: 'head', head_repository: { full_name: fullName }, pull_requests: [{ number: 1 }], status: 'completed', conclusion: 'success' }] }) },
      issues: { addLabels: endpoint('label', {}), getLabel: endpoint('getLabel', {}), createLabel: endpoint('createLabel', {}) },
    },
    paginate: async (_method, { base }) => !options.empty && base === pr.base.ref ? [pr] : [],
  };
  const context = { repo: { owner: 'BWCbewchan', repo: 'tpsmindx' }, payload: options.payload || {} };
  const core = { info: m => notes.push(m), setFailed: m => errors.push(m) };
  const env = { VERCEL_TOKEN: 'fake', VERCEL_PROJECT_ID: 'prj_test', ...options.env };
  const fetchImpl = async () => ({ ok: options.vercelStatus ? false : true, status: options.vercelStatus || 200, json: async () => ({ deployments: options.deployments || [] }) });
  return { calls, errors, notes, run: () => reconcile({ github, context, core, env, fetchImpl }), github };
}

test('personal branches exclude release branches and dependency bots', () => {
  for (const branch of ['kydai', 'codex/fix', 'feature/x']) assert.equal(personal(branch), true);
  for (const branch of ['main', 'preview', 'dependabot/x', 'renovate/x', null]) assert.equal(personal(branch), false);
});
test('strict protection and admin enforcement are mandatory', () => {
  assert.equal(protectedForCI(policy), true);
  assert.equal(protectedForCI({ ...policy, enforce_admins: { enabled: false } }), false);
  assert.equal(protectedForCI({ ...policy, required_status_checks: { contexts: ['CI'], strict: false } }), false);
});
test('only the exact Vercel project, repository, branch and SHA qualify', () => {
  const config = { sha: 'head', projectId: 'prj_test', repository: fullName };
  assert.ok(latestPreview([deployment()], config));
  for (const d of [deployment({ projectId: 'other' }), deployment({ target: 'production' }), deployment({ customEnvironment: { slug: 'staging' } }), deployment({ meta: { ...deployment().meta, githubCommitSha: 'old' } }), deployment({ meta: { ...deployment().meta, githubCommitRepo: 'other' } })]) assert.equal(latestPreview([d], config), null);
  for (const readyState of ['BUILDING', 'ERROR', 'CANCELED']) {
    assert.equal(latestPreview([deployment(), deployment({ createdAt: 2, readyState })], config), null);
  }
});
test('passing latest PR CI merges personal branch using expected head SHA', async () => {
  const f = fixture(); await f.run();
  assert.deepEqual(f.calls.find(([name]) => name === 'merge')[1], { owner: 'BWCbewchan', repo: 'tpsmindx', pull_number: 1, sha: 'head', merge_method: 'merge' });
  assert.deepEqual(f.errors, []);
});
test('a newer failed or pending CI run prevents reuse of old success', async () => {
  const successful = { id: 1, path: '.github/workflows/ci.yml', head_sha: 'head', head_repository: { full_name: fullName }, pull_requests: [{ number: 1 }], status: 'completed', conclusion: 'success' };
  for (const latest of [{ conclusion: 'failure' }, { status: 'in_progress', conclusion: null }]) {
    const f = fixture({ runs: [successful, { ...successful, id: 2, ...latest }] }); await f.run();
    assert.ok(!f.calls.some(([name]) => name === 'merge'));
  }
});
test('CI for an old SHA, another PR or a fork cannot authorize merge', async () => {
  for (const mismatch of [{ head_sha: 'old' }, { pull_requests: [{ number: 99 }] }, { head_repository: { full_name: 'attacker/fork' } }]) {
    const f = fixture({ runs: [{ id: 1, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success', head_sha: 'head', head_repository: { full_name: fullName }, pull_requests: [{ number: 1 }], ...mismatch }] });
    await f.run(); assert.ok(!f.calls.some(([name]) => name === 'merge'));
  }
});
test('outdated branch updates then waits for fresh CI', async () => {
  const f = fixture({ behind: 1 }); await f.run();
  assert.equal(f.calls.find(([name]) => name === 'updateBranch')[1].expected_head_sha, 'head');
  assert.ok(!f.calls.some(([name]) => name === 'merge'));
});
test('outdated release syncs main through a separate PR instead of pushing protected preview', async () => {
  const f = fixture({ release: true, behind: 1 }); await f.run();
  assert.ok(f.calls.some(([name]) => name === 'syncMerge'));
  assert.ok(f.calls.some(([name, args]) => name === 'createPR' && args.base === 'preview' && args.head.startsWith('automation/sync-main-')));
  assert.ok(!f.calls.some(([name]) => name === 'updateBranch' || name === 'merge'));
});
test('history-only synchronization PRs still merge to satisfy strict protection', async () => {
  const f = fixture({ files: [], pr: { head: { ref: 'automation/sync-main-abc', sha: 'head', repo: { full_name: fullName } } } });
  await f.run(); assert.ok(f.calls.some(([name]) => name === 'merge'));
});
test('forks, drafts, manual PRs, conflicts and missing policy do not merge', async () => {
  for (const options of [{ pr: { draft: true } }, { pr: { labels: [{ name: 'manual-merge' }, { name: 'auto-delivery' }] } }, { pr: { head: { ref: 'fork', sha: 'head', repo: { full_name: 'attacker/fork' } } } }, { pr: { mergeable: false } }, { policy: {} }]) {
    const f = fixture(options); await f.run(); assert.ok(!f.calls.some(([name]) => name === 'merge'));
  }
});
test('head or base movement and a newly added manual label stop merge', async () => {
  for (const fresh of [pr => ({ ...pr, head: { ...pr.head, sha: 'new' } }), pr => ({ ...pr, base: { ...pr.base, sha: 'new-base' } }), pr => ({ ...pr, labels: [{ name: 'manual-merge' }] })]) {
    const f = fixture({ fresh }); await f.run(); assert.ok(!f.calls.some(([name]) => name === 'merge'));
  }
});
test('release waits for exact preview deployment; READY permits merge', async () => {
  const waiting = fixture({ release: true }); await waiting.run(); assert.ok(!waiting.calls.some(([name]) => name === 'merge'));
  const ready = fixture({ release: true, deployments: [deployment()] }); await ready.run();
  assert.ok(ready.calls.some(([name]) => name === 'merge'));
});
test('deleted/stale source branch event does not enroll a PR', async () => {
  const f = fixture({ payload: { workflow_run: { path: '.github/workflows/ci.yml', head_repository: { full_name: fullName }, head_branch: 'kydai', head_sha: 'stale' } } });
  await f.run(); assert.ok(!f.calls.some(([name]) => name === 'createPR'));
});
test('personal push creates and labels exactly one PR; existing PR is reused', async () => {
  const payload = { workflow_run: { path: '.github/workflows/ci.yml', head_repository: { full_name: fullName }, head_branch: 'kydai', head_sha: 'head' } };
  const fresh = fixture({ payload, empty: true }); await fresh.run();
  assert.equal(fresh.calls.filter(([name]) => name === 'createPR').length, 1);
  assert.ok(fresh.calls.some(([name]) => name === 'label'));
  const existing = fixture({ payload }); await existing.run();
  assert.ok(!existing.calls.some(([name]) => name === 'createPR'));
});
test('source branches deleted before reconciliation are not recreated', async () => {
  const payload = { workflow_run: { path: '.github/workflows/ci.yml', head_repository: { full_name: fullName }, head_branch: 'deleted', head_sha: 'head' } };
  const f = fixture({ payload, empty: true });
  const getBranch = f.github.rest.repos.getBranch;
  f.github.rest.repos.getBranch = async args => {
    if (args.branch === 'deleted') throw Object.assign(new Error('missing'), { status: 404 });
    return getBranch(args);
  };
  await f.run(); assert.ok(!f.calls.some(([name]) => name === 'createPR'));
});
test('Vercel API errors or missing credentials block production promotion', async () => {
  for (const options of [{ vercelStatus: 403 }, { env: { VERCEL_TOKEN: '' } }]) {
    const f = fixture({ release: true, ...options }); await f.run();
    assert.ok(!f.calls.some(([name]) => name === 'merge'));
    assert.ok(f.errors.length > 0);
  }
});
test('GitHub merge rejection is reported as a failure', async () => {
  const f = fixture({ mergeAccepted: false }); await f.run();
  assert.match(f.errors.join(' '), /declined merge/);
});
