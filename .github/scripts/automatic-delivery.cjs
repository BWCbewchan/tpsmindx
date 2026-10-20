const LABEL = 'auto-delivery';
const MANUAL = 'manual-merge';

function personal(branch) {
  return typeof branch === 'string' && branch !== 'main' && branch !== 'preview'
    && !branch.startsWith('dependabot/') && !branch.startsWith('renovate/');
}


module.exports = async function reconcile({ github, context, core, env = process.env,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
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
      body: 'Automatic delivery: personal branches merge into preview without a CI gate. Release to main requires the latest preview commit to have a successful Vercel deployment. Add `manual-merge` or convert to draft to pause this PR.',
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
    const environment = env.VERCEL_PREVIEW_ENVIRONMENT || 'Preview';
    const deployments = await github.paginate(github.rest.repos.listDeployments, { ...repo, ref: sha, environment, per_page: 100 });
    const trusted = deployments.filter(d => d.sha === sha && !d.production_environment
      && (d.performed_via_github_app?.slug === 'vercel' || d.creator?.login === 'vercel[bot]'));
    trusted.sort((a, b) => b.id - a.id);
    if (!trusted.length) return false;
    const { data } = await github.rest.repos.listDeploymentStatuses({ ...repo, deployment_id: trusted[0].id, per_page: 100 });
    data.sort((a, b) => b.id - a.id);
    // Never accept an older success while a newer deployment/status is pending or failed.
    return data[0]?.state === 'success';
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
    // A new ref can be readable by the refs API before the merge API sees it.
    // Retry only that specific propagation error, never conflicts or permissions.
    for (let attempt = 0; ; attempt++) {
      try {
        await github.rest.repos.merge({ ...repo, base: sync, head: base.commit.sha,
          commit_message: 'chore: synchronize main into preview for the next release' });
        break;
      } catch (error) {
        if (error.status === 404 && /base does not exist/i.test(error.message) && attempt < 3) {
          note(`Waiting for synchronization branch ${sync} to become available (${attempt + 1}/3).`);
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        throw new Error(`Synchronize main into ${sync}: ${error.message}`, { cause: error });
      }
    }
    await ensurePR(sync, 'preview');
    note('Waiting for merge of the main → preview synchronization PR and its new Vercel deployment.');
  }

  async function processPR(summary) {
    let pr = (await github.rest.pulls.get({ ...repo, pull_number: summary.number })).data;
    if (pr.state !== 'open' || pr.draft || !sameRepo(pr) || hasLabel(pr, MANUAL)) return;
    const release = pr.base.ref === 'main' && pr.head.ref === 'preview';
    if (!(release || (pr.base.ref === 'preview' && personal(pr.head.ref)))) return;
    if (pr.mergeable === false) throw new Error(`PR #${pr.number} has conflicts. Resolve them on ${pr.head.ref}.`);
    if (pr.mergeable == null) { note(`PR #${pr.number}: GitHub is calculating mergeability; retry later.`); return; }

    const base = await branch(pr.base.ref);
    const head = await branch(pr.head.ref);
    if (head.commit.sha !== pr.head.sha) { note(`PR #${pr.number}: head changed; retry later.`); return; }
    const comparison = (await github.rest.repos.compareCommitsWithBasehead({ ...repo, basehead: `${base.commit.sha}...${head.commit.sha}` })).data;
    if (release && comparison.behind_by > 0) { await syncMainToPreview(base, head); return; }
    if (!comparison.files?.length
      && !(pr.head.ref.startsWith('automation/sync-main-') && comparison.ahead_by > 0)) {
      note(`PR #${pr.number}: no code differences.`); return;
    }
    if (release && !await vercelReady(pr.head.sha)) { note(`PR #${pr.number}: latest preview deployment is not READY.`); return; }

    // Refresh after API calls; expected SHA prevents merging a newer, unbuilt head.
    const fresh = (await github.rest.pulls.get({ ...repo, pull_number: pr.number })).data;
    if (fresh.state !== 'open' || fresh.draft || hasLabel(fresh, MANUAL)
      || fresh.head.sha !== pr.head.sha || fresh.base.sha !== base.commit.sha || fresh.mergeable !== true) {
      note(`PR #${pr.number}: state changed; retry later.`); return;
    }
    const result = await github.rest.pulls.merge({ ...repo, pull_number: pr.number, sha: pr.head.sha, merge_method: 'merge' });
    if (!result.data.merged) throw new Error(`GitHub declined merge for PR #${pr.number}.`);
    note(`Merged PR #${pr.number}: ${pr.head.ref} → ${pr.base.ref}`);
  }

  // Process direct pushes; no CI completion or Vercel token is needed for enrollment.
  const pushedBranch = context.eventName === 'push' && !context.payload.deleted
    && context.payload.ref?.startsWith('refs/heads/') ? context.payload.ref.slice(11) : null;
  if (personal(pushedBranch) && context.payload.repository?.full_name?.toLowerCase() === fullName.toLowerCase()) {
    try {
      const current = await branch(pushedBranch);
      if (current.commit.sha === context.payload.after) await ensurePR(pushedBranch, 'preview');
    } catch (error) {
      if (error.status !== 404) throw error;
      note('Source branch was deleted; skipping.');
    }
  }

  // Reconcile same-repository PRs too, including manually opened PRs.
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
