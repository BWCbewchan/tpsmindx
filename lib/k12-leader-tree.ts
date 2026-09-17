export interface LeaderTreeRow {
  id: number;
  slug: string;
  relative_path: string;
  parent_id: number | null;
  section_id: number | null;
  type: 'section' | 'article';
  sort_order: number;
}

export function effectiveLeaderParent(rows: LeaderTreeRow[], row: LeaderTreeRow): number | null {
  if (row.parent_id != null && rows.some(item => item.id === row.parent_id)) return row.parent_id;
  const path = row.relative_path.replace(/\\/g, '/').replace(/\.md$/i, '').replace(/\/index$/i, '');
  const parentPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  return rows.find(item => item.id !== row.id && item.relative_path.replace(/\\/g, '/').replace(/\.md$/i, '').replace(/\/index$/i, '') === parentPath)?.id ?? null;
}

export function planLeaderReorder(rows: LeaderTreeRow[], parentSlug: string | null, slugs: string[]) {
  const parent = parentSlug ? rows.find(row => row.slug === parentSlug) : null;
  if (parentSlug && !parent) throw new Error('Không tìm thấy đầu mục cha');
  const siblings = rows.filter(row => effectiveLeaderParent(rows, row) === (parent?.id ?? null));
  if (!slugs.length || new Set(slugs).size !== slugs.length || siblings.length !== slugs.length ||
      slugs.some(slug => !siblings.some(row => row.slug === slug))) {
    throw new Error('Danh sách mục cùng cấp đã thay đổi. Vui lòng tải lại tài liệu.');
  }
  return slugs.map((slug, sort_order) => ({ ...siblings.find(row => row.slug === slug)!, sort_order }));
}

export function planLeaderMove(rows: LeaderTreeRow[], sourceSlug: string, nextSlug: string, parentSlug: string | null, sortOrder?: number) {
  const source = rows.find(row => row.slug === sourceSlug);
  const parent = parentSlug ? rows.find(row => row.slug === parentSlug) : null;
  if (!source || (parentSlug && !parent)) throw new Error('Không tìm thấy tài liệu hoặc đầu mục cha');
  const subtree = new Set([source.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (!subtree.has(row.id) && (row.slug.startsWith(`${sourceSlug}/`) || subtree.has(effectiveLeaderParent(rows, row)!))) {
        subtree.add(row.id);
        changed = true;
      }
    }
  }
  if (parent && subtree.has(parent.id)) throw new Error('Không thể chuyển đầu mục vào chính nó hoặc mục con');
  const expectedParent = nextSlug.includes('/') ? nextSlug.slice(0, nextSlug.lastIndexOf('/')) : null;
  if (!nextSlug || expectedParent !== parentSlug) throw new Error('Đường dẫn không khớp với đầu mục cha');

  const moved = rows.filter(row => subtree.has(row.id)).map(row => {
    const slug = row.id === source.id ? nextSlug : `${nextSlug}${row.slug.slice(sourceSlug.length)}`;
    if (row.id !== source.id && !row.slug.startsWith(`${sourceSlug}/`)) {
      throw new Error('Phân cấp mục con không khớp đường dẫn. Vui lòng sửa phân cấp trước.');
    }
    const relative_path = row.relative_path.endsWith('/index.md') ? `${slug}/index.md` : `${slug}.md`;
    return { ...row, slug, relative_path,
      parent_id: row.id === source.id ? parent?.id ?? null : effectiveLeaderParent(rows, row),
      sort_order: row.id === source.id ? sortOrder ?? row.sort_order : row.sort_order };
  });
  if (moved.some(row => rows.some(other => !subtree.has(other.id) && (other.slug === row.slug || other.relative_path === row.relative_path)))) {
    throw new Error('Đầu mục đích đã có tài liệu trùng đường dẫn');
  }
  const nextRows = rows.map(row => moved.find(item => item.id === row.id) || row);
  for (const row of moved) {
    row.section_id = null;
    if (row.type === 'section') continue;
    let ancestor = nextRows.find(item => item.id === row.parent_id);
    const visited = new Set<number>();
    while (ancestor && !visited.has(ancestor.id)) {
      visited.add(ancestor.id);
      if (ancestor.type === 'section') { row.section_id = ancestor.id; break; }
      ancestor = nextRows.find(item => item.id === ancestor!.parent_id);
    }
  }
  return moved;
}

/** Moving down inserts after the target; moving up inserts before it. */
export function reorderLeaderSlugs(slugs: string[], source: string, target: string) {
  const from = slugs.indexOf(source);
  const to = slugs.indexOf(target);
  if (from < 0 || to < 0 || from === to) return slugs;
  const next = [...slugs];
  next.splice(from, 1);
  next.splice(to, 0, source);
  return next;
}
