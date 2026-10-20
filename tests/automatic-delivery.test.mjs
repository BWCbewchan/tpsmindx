import test from 'node:test';
import assert from 'node:assert/strict';
import reconcile from '../.github/scripts/automatic-delivery.cjs';
const { personal } = reconcile;

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
        listDeployments: 'deployments',
        listDeploymentStatuses: endpoint('deploymentStatuses', options.statuses || []),
        merge: endpoint('syncMerge', {}),
        compareCommitsWithBasehead: endpoint('compare', { behind_by: options.behind || 0, ahead_by: 1, files: options.files || [{ filename: 'app/page.tsx' }] }),
      },
      git: { getRef: endpoint('getRef', { object: { sha: 'head' } }), createRef: endpoint('createRef', {}) },
      actions: { listWorkflowRuns: endpoint('ci', { workflow_runs: options.runs || [{ id: 10, path: '.github/workflows/ci.yml', head_sha: 'head', head_repository: { full_name: fullName }, pull_requests: [{ number: 1 }], status: 'completed', conclusion: 'success' }] }) },
      issues: { addLabels: endpoint('label', {}), getLabel: endpoint('getLabel', {}), createLabel: endpoint('createLabel', {}) },
    },
    paginate: async (method, { base }) => method === 'deployments' ? (options.deployments || []) : (!options.empty && base === pr.base.ref ? [pr] : []),
  };
  const context = { repo: { owner: 'BWCbewchan', repo: 'tpsmindx' }, eventName: options.eventName || '', payload: options.payload || {} };
  const core = { info: m => notes.push(m), setFailed: m => errors.push(m) };
  const env = { VERCEL_TOKEN: 'fake', VERCEL_PROJECT_ID: 'prj_test', ...options.env };
  const fetchImpl = async () => ({ ok: options.vercelStatus ? false : true, status: options.vercelStatus || 200, json: async () => ({ deployments: options.deployments || [] }) });
  return { calls, errors, notes, run: () => reconcile({ github, context, core, env, fetchImpl }), github };
}


const successfulDeployment = { id: 5, sha: 'head', environment: 'Preview', creator: { login: 'vercel[bot]' } };
test('personal branch merges without CI, protection or Vercel success', async () => {
 const f=fixture();await f.run();assert.ok(f.calls.some(([n])=>n==='merge'));assert.ok(!f.calls.some(([n])=>n==='ci'||n==='protection'));
});
test('personal branch behind preview can merge without forced synchronization',async()=>{
 const f=fixture({behind:2});await f.run();assert.ok(f.calls.some(([n])=>n==='merge'));assert.ok(!f.calls.some(([n])=>n==='updateBranch'));
});
test('release requires latest trusted Vercel deployment for exact SHA',async()=>{
 for(const options of [{},{deployments:[successfulDeployment],statuses:[{id:1,state:'failure'}]},{deployments:[{...successfulDeployment,sha:'old'}],statuses:[{id:1,state:'success'}]},{deployments:[{...successfulDeployment,creator:{login:'someone'}}],statuses:[{id:1,state:'success'}]}]){
  const f=fixture({release:true,...options});await f.run();assert.ok(!f.calls.some(([n])=>n==='merge'));
 }
 const f=fixture({release:true,deployments:[successfulDeployment],statuses:[{id:1,state:'success'}]});await f.run();assert.ok(f.calls.some(([n])=>n==='merge'));
});
test('new deployment pending cannot reuse old success',async()=>{
 const f=fixture({release:true,deployments:[successfulDeployment,{...successfulDeployment,id:6}],statuses:[{id:2,state:'pending'},{id:1,state:'success'}]});await f.run();assert.ok(!f.calls.some(([n])=>n==='merge'));
});
test('forks, conflicts, drafts and manual labels never auto merge',async()=>{
 for(const pr of [{draft:true},{mergeable:false},{head:{ref:'fork',sha:'head',repo:{full_name:'other/fork'}}},{labels:[{name:'manual-merge'}]}]){const f=fixture({pr});await f.run();assert.ok(!f.calls.some(([n])=>n==='merge'));}
});
test('head and base movement stop merge',async()=>{
 for(const fresh of [pr=>({...pr,head:{...pr.head,sha:'new'}}),pr=>({...pr,base:{...pr.base,sha:'new'}})]){const f=fixture({fresh});await f.run();assert.ok(!f.calls.some(([n])=>n==='merge'));}
});
test('direct source push creates PR without waiting for CI',async()=>{
 const f=fixture({empty:true,eventName:'push',payload:{repository:{full_name:fullName},ref:'refs/heads/kydai',after:'head'}});await f.run();assert.ok(f.calls.some(([n])=>n==='createPR'));
});
test('stale and deleted push do not create PR',async()=>{
 for(const extra of [{after:'old'},{after:'head',deleted:true}]){const f=fixture({empty:true,eventName:'push',payload:{repository:{full_name:fullName},ref:'refs/heads/kydai',...extra}});await f.run();assert.ok(!f.calls.some(([n])=>n==='createPR'));}
});
test('outdated release synchronizes main through preview before building again',async()=>{
 const f=fixture({release:true,behind:1});await f.run();assert.ok(f.calls.some(([n])=>n==='syncMerge'));assert.ok(!f.calls.some(([n])=>n==='merge'));
});
