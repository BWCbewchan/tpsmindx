import { PageContainer } from "@/components/PageContainer";
import Link from "next/link";

export default function AdminK12CustomPage() {
	return (
		<PageContainer
			title="Noi dung tuy chinh K12 Teaching"
			description="Trang nay da duoc khoi phuc de su dung on dinh"
		>
			<div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
				<p className="text-sm text-gray-700">
					Trang custom dang san sang. Neu ban muon, minh se tiep tuc chinh no theo dung flow GitBook.
				</p>
				<div className="mt-3">
					<Link href="/admin/page2" className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
						Quay ve trang quy trinh
					</Link>
				</div>
			</div>
		</PageContainer>
	);
}
