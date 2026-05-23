import K12DocsClient from "@/components/k12-docs/K12DocsClient";
import { loadK12Docs } from "@/lib/k12-docs";

interface PageProps {
  searchParams: Promise<{ doc?: string | string[] }>;
}

export default async function Page2({ searchParams }: PageProps) {
  const params = await searchParams;
  const docs = await loadK12Docs({ includeDraft: true });
  const rawDoc = params.doc;
  const selectedSlug = Array.isArray(rawDoc) ? rawDoc[0] : rawDoc || docs.defaultSlug;

  return (
    <K12DocsClient
      basePath="/admin/page2"
      pageTitle="Quy Trình, Quy Định K12 Teaching"
      tree={docs.tree}
      documents={docs.documents}
      selectedSlug={selectedSlug}
      defaultSlug={docs.defaultSlug}
    />
  );
}
