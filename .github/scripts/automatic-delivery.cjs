const LABEL = 'auto-delivery';
const MANUAL = 'manual-merge';
const CI_PATH = '.github/workflows/ci.yml';

function personal(branch) {
  return typeof branch === 'string' && branch !== 'main' && branch !== 'preview'
    && !branch.startsWith('dependabot/') && !branch.startsWith('renovate/');
}

function protectedForCI(policy) {
  const checks = policy?.required_status_checks;
  const names = [...(checks?.contexts || []), ...(checks?.checks || []).map(c => c.context)];
  return checks?.strict === true && names.includes('CI') && policy?.enforce_admins?.enabled === true;
}

function latestPreview(deployments, { sha, projectId, repository }) {
  const candidates = deployments.filter(d => d.projectId === projectId
    && d.meta?.githubCommitSha === sha && d.meta?.githubCommitRef === 'preview'
    && `${d.meta?.githubCommitOrg}/${d.meta?.githubCommitRepo}`.toLowerCase() === repository.toLowerCase()
    && d.target !== 'production' && !d.customEnvironment);
  // Never select an older READY result while a newer redeploy is pending/failed.
  candidates.sort((a, b) => Number(b.createdAt || b.created) - Number(a.createdAt || a.created));
  return candidates[0]?.readyState === 'READY' ? candidates[0] : null;
}

module.exports = async function reconcile({ github, context, core, env = process.env, fetchImpl = fetch }) {
  const repo = context.repo;
  const fullName = `${repo.owner}/${repo.repo}`;
  const note = message => core.info(message);
  const listPRs = base => github.paginate(github.rest.pulls.list, { ...repo, state: 'open', base, per_page: 100 });
  const branch = async name => (await github.rest.repos.getBranch({ ...repo, branch: name })).data;
  const sameRepo = pr => pr.head?.repo?.full_name?.toLowerCase() === fullName.toLowerCase();
  const hasLabel = (pr, label) => pr.labels?.some(l => l.name === label);

  async function ensurePR(head, base) {
    const existing = (await listPRs(base)).find(pr => sameRepo(pr) && pr.head.ref === head);
    if (existing?.draft || (existing && hasLabel(existing, MANUAL))) return;
    if (!existing) {
      const comparison = await github.rest.repos.compareCommitsWithBasehead({ ...repo, basehead: `${base}...${head}` });
      // Ignore history-only divergence with the same tree, and empty branches.
      if (!comparison.data.files?.length
        && !(head.startsWith('automation/sync-main-') && comparison.data.ahead_by > 0)) return;
    }
    const pr = existing || (await github.rest.pulls.create({ ...repo, head, base,
      title: head === 'preview' ? 'Release: preview → main' : `Integrate: ${head} → preview`,
      body: 'Automatic delivery: CI must pass for the latest commit. Release to main also requires the exact preview commit to be READY on Vercel. Add `manual-merge` or convert to draft to pause this PR.',
    })).data;
    if (!hasLabel(pr, LABEL)) {
      try { await github.rest.issues.getLabel({ ...repo, name: LABEL }); }
      catch (error) {
        if (error.status !== 404) throw error;
        await github.rest.issues.createLabel({ ...repo, name: LABEL, color: '0e8a16', description: 'Managed by automatic delivery' });
      }
      await github.rest.issues.addLabels({ ...repo, issue_number: pr.number, labels: [LABEL] });
    }
    note(`Enrolled PR #${pr.number}: ${head} → ${base}`);
  }

  async function vercelReady(sha) {
    if (!env.VERCEL_TOKEN || !env.VERCEL_PROJECT_ID) {
      throw new Error('Configure VERCEL_TOKEN and VERCEL_PROJECT_ID before promotion to main.');
    }
    const url = new URL('https://api.vercel.com/v7/deployments');
    url.search = new URLSearchParams({ projectId: env.VERCEL_PROJECT_ID, branch: 'preview', sha, target: 'preview', limit: '100',
      ...(env.VERCEL_TEAM_ID ? { teamId: env.VERCEL_TEAM_ID } : {}),
    }).toString();
    const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Vercel verification failed (HTTP ${response.status}).`);
    const result = await response.json();
    if (!Array.isArray(result.deployments)) throw new Error('Invalid Vercel deployments response.');
    return latestPreview(result.deployments, { sha, projectId: env.VERCEL_PROJECT_ID, repository: fullName });
  }

  async function latestPRCI(pr) {
    const { data } = await github.rest.actions.listWorkflowRuns({ ...repo, workflow_id: 'ci.yml', event: 'pull_request', head_sha: pr.head.sha, per_page: 100 });
    const runs = data.workflow_runs.filter(r => r.path === CI_PATH && r.head_sha === pr.head.sha
      && r.head_repository?.full_name?.toLowerCase() === fullName.toLowerCase()
      && r.pull_requests?.some(p => p.number === pr.number));
    runs.sort((a, b) => b.id - a.id);
    return runs[0]?.status === 'completed' && runs[0]?.conclusion === 'success';
  }

  async function syncMainToPreview(base, head) {
    // preview is protected too: never push to it or update it as a PR head directly.
    const sync = `automation/sync-main-${base.commit.sha.slice(0, 12)}`;
    try {
      await github.rest.git.getRef({ ...repo, ref: `heads/${sync}` });
    } catch (error) {
      if (error.status !== 404) throw error;
      await github.rest.git.createRef({ ...repo, ref: `refs/heads/${sync}`, sha: head.commit.sha });
    }
    await github.rest.repos.merge({ ...repo, base: sync, head: base.commit.sha,
      commit_message: 'chore: synchronize main into preview for the next release' });
    await ensurePR(sync, 'preview');
    note('Waiting for CI and merge of the main → preview synchronization PR.');
  }

  async function processPR(summary) {
    let pr = (await github.rest.pulls.get({ ...repo, pull_number: summary.number })).data;
    if (pr.state !== 'open' || pr.draft || !sameRepo(pr) || !hasLabel(pr, LABEL) || hasLabel(pr, MANUAL)) return;
    const release = pr.base.ref === 'main' && pr.head.ref === 'preview';
    if (!(release || (pr.base.ref === 'preview' && personal(pr.head.ref)))) return;
    if (pr.mergeable === false) throw new Error(`PR #${pr.number} has conflicts. Resolve them on ${pr.head.ref}.`);
    if (pr.mergeable == null) { note(`PR #${pr.number}: GitHub is calculating mergeability; retry later.`); return; }

    const policy = (await github.rest.repos.getBranchProtection({ ...repo, branch: pr.base.ref })).data;
    if (!protectedForCI(policy)) throw new Error(`Protect ${pr.base.ref}: require CI, strict up-to-date checks, and enforcement for administrators.`);
    const base = await branch(pr.base.ref);
    const head = await branch(pr.head.ref);
    if (head.commit.sha !== pr.head.sha) { note(`PR #${pr.number}: head changed; wait for new CI.`); return; }
    const comparison = (await github.rest.repos.compareCommitsWithBasehead({ ...repo, basehead: `${base.commit.sha}...${head.commit.sha}` })).data;
    if (comparison.behind_by > 0) {
      if (release) { await syncMainToPreview(base, head); return; }
      await github.rest.pulls.updateBranch({ ...repo, pull_number: pr.number, expected_head_sha: pr.head.sha });
      note(`Updated ${pr.head.ref} from ${pr.base.ref}; waiting for fresh CI${release ? ' and a fresh Vercel preview' : ''}.`);
      return;
    }
    if (!comparison.files?.length
      && !(pr.head.ref.startsWith('automation/sync-main-') && comparison.ahead_by > 0)) {
      note(`PR #${pr.number}: no code differences.`); return;
    }
    if (!await latestPRCI(pr)) { note(`PR #${pr.number}: waiting for successful latest PR CI.`); return; }
    if (release && !await vercelReady(pr.head.sha)) { note(`PR #${pr.number}: latest preview deployment is not READY.`); return; }

    // Refresh after API calls. GitHub strict protection handles a base race after this read;
    // the expected SHA prevents merging a newer, untested head.
    const fresh = (await github.rest.pulls.get({ ...repo, pull_number: pr.number })).data;
    if (fresh.state !== 'open' || fresh.draft || hasLabel(fresh, MANUAL) || !hasLabel(fresh, LABEL)
      || fresh.head.sha !== pr.head.sha || fresh.base.sha !== base.commit.sha || fresh.mergeable !== true) {
      note(`PR #${pr.number}: state changed; retry later.`); return;
    }
    const result = await github.rest.pulls.merge({ ...repo, pull_number: pr.number, sha: pr.head.sha, merge_method: 'merge' });
    if (!result.data.merged) throw new Error(`GitHub declined merge for PR #${pr.number}.`);
    note(`Merged PR #${pr.number}: ${pr.head.ref} → ${pr.base.ref}`);
  }

  // Only a CI event for a currently existing same-repository personal branch enrolls it.
  // Read current branch SHA; never revive a deleted branch or trust a stale event.
  const run = context.payload.workflow_run;
  if (run?.path === CI_PATH && run.head_repository?.full_name?.toLowerCase() === fullName.toLowerCase() && personal(run.head_branch)) {
    try {
      const current = await branch(run.head_branch);
      if (current.commit.sha === run.head_sha) await ensurePR(run.head_branch, 'preview');
    } catch (error) {
      if (error.status !== 404) throw error;
      note('Source branch was deleted; skipping.');
    }
  }

  // Existing human PRs are not enrolled in bulk. Only auto-delivery PRs are reconciled.
  const failures = [];
  for (const pr of await listPRs('preview')) {
    try { await processPR(pr); } catch (error) { failures.push(`PR #${pr.number}: ${error.message}`); }
  }
  try {
    const preview = await branch('preview');
    if (await vercelReady(preview.commit.sha)) await ensurePR('preview', 'main');
    for (const pr of await listPRs('main')) {
      try { await processPR(pr); } catch (error) { failures.push(`PR #${pr.number}: ${error.message}`); }
    }
  } catch (error) { failures.push(error.message); }
  if (failures.length) core.setFailed(failures.join('\n'));
};
module.exports.personal = personal;
module.exports.protectedForCI = protectedForCI;
module.exports.latestPreview = latestPreview;
