import { requireBearerSession } from '@/lib/datasource-api-auth';
import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { getHrCandidateSheetData } from '@/lib/hr-candidate-sheet';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const SOUTH_REGION_CODES: Array<'1' | '3'> = ['1', '3'];
const NORTH_REGION_CODES: Array<'2' | '4' | '5'> = ['2', '4', '5'];

type RegionCode = '1' | '2' | '3' | '4' | '5';

type SessionVideo = {
	id: number;
	title: string;
	lesson_number: number | null;
	start_date: string | null;
};

type TeacherVideoScore = {
	teacher_code: string;
	video_id: number;
	score: number | null;
	completion_status: string | null;
	view_count: number | null;
	time_spent_seconds: number | null;
};

type TeacherStats = {
	teacher_code: string;
	work_email: string;
};

type HrAssignmentRow = {
	candidate_key: string;
	assigned_gen: string;
};

function normalizeValue(input: unknown): string {
	if (typeof input !== 'string') return '';
	return input.trim();
}

function normalizeEmail(input: unknown): string {
	return normalizeValue(input).toLowerCase();
}

function normalizeSearchText(value: string): string {
	return value
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim();
}

function normalizeRegionCode(value: string): RegionCode | null {
	const normalized = normalizeValue(value);
	if (['1', '2', '3', '4', '5'].includes(normalized)) {
		return normalized as RegionCode;
	}
	return null;
}

function resolveRegionCodes(regionFilter: string): RegionCode[] | null {
	const normalized = normalizeValue(regionFilter).toLowerCase();
	if (!normalized || normalized === 'all') return null;
	if (normalized === 'south') return SOUTH_REGION_CODES;
	if (normalized === 'north') return NORTH_REGION_CODES;

	const single = normalizeRegionCode(normalized);
	if (single) return [single];

	return null;
}

function parsePageParam(input: string | null, fallback: number): number {
	if (!input) return fallback;
	const parsed = Number(input);
	if (Number.isNaN(parsed) || parsed < 1) return fallback;
	return Math.floor(parsed);
}

function toNumber(value: unknown): number | null {
	const parsed = Number(value);
	return Number.isNaN(parsed) ? null : parsed;
}

function hasAttendance(scoreRow: TeacherVideoScore | undefined): boolean {
	if (!scoreRow) return false;
	const completion = normalizeValue(scoreRow.completion_status).toLowerCase();
	if (completion === 'completed' || completion === 'in_progress') return true;

	return Number(scoreRow.view_count || 0) > 0 || Number(scoreRow.time_spent_seconds || 0) > 0;
}

async function validateTrainingTabAccess(requestEmail: string): Promise<{ ok: boolean; status: number; message?: string }> {
	const userResult = await pool.query(
		`SELECT id, role, is_active
		 FROM app_users
		 WHERE email = $1
		 LIMIT 1`,
		[requestEmail]
	);

	if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
		return { ok: false, status: 403, message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.' };
	}

	const user = userResult.rows[0] as { id: number; role: string };
	const normalizedRole = normalizeValue(user.role).toLowerCase();
	if (normalizedRole === 'hr' || normalizedRole === 'super_admin') {
		return { ok: true, status: 200 };
	}

	const rolesResult = await pool.query(
		`SELECT role_code
		 FROM user_roles
		 WHERE user_id = $1`,
		[user.id]
	);

	const hasTeTfRole = rolesResult.rows.some((row: { role_code: string }) => {
		const roleCode = normalizeValue(row.role_code).toUpperCase();
		return roleCode === 'TE' || roleCode === 'TF';
	});

	if (!hasTeTfRole) {
		return { ok: false, status: 403, message: 'Chỉ HR, TE hoặc TF mới có quyền truy cập tab theo dõi GEN training.' };
	}

	return { ok: true, status: 200 };
}

async function getUserRoleCodes(requestEmail: string): Promise<string[]> {
	const userResult = await pool.query(
		`SELECT id, role, is_active
		 FROM app_users
		 WHERE email = $1
		 LIMIT 1`,
		[requestEmail]
	);

	if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
		return [];
	}

	const user = userResult.rows[0] as { id: number; role: string };
	const roleCodes = new Set<string>();

	const normalizedRole = normalizeValue(user.role).toUpperCase();
	if (normalizedRole) roleCodes.add(normalizedRole);

	const rolesResult = await pool.query(
		`SELECT role_code
		 FROM user_roles
		 WHERE user_id = $1`,
		[user.id]
	);

	for (const row of rolesResult.rows as Array<{ role_code: string }>) {
		const roleCode = normalizeValue(row.role_code).toUpperCase();
		if (roleCode) roleCodes.add(roleCode);
	}

	return Array.from(roleCodes);
}

function canEditTrainingTab(roleCodes: string[]): boolean {
	return roleCodes.some((roleCode) => {
		const normalized = roleCode.toUpperCase();
		return normalized === 'HR' || normalized === 'TE' || normalized === 'TF';
	});
}

const handleGet = async (request: NextRequest) => {
	try {
		const auth = await requireBearerSession(request);
		if (!auth.ok) return auth.response;

		const searchParams = request.nextUrl.searchParams;
		const requestEmail = auth.sessionEmail;

		const access = await validateTrainingTabAccess(requestEmail);
		if (!access.ok) {
			return NextResponse.json({ error: access.message || 'Không có quyền truy cập.' }, { status: access.status });
		}

		const regionFilter = normalizeValue(searchParams.get('region'));
		const genFilter = normalizeValue(searchParams.get('gen'));
		const search = normalizeValue(searchParams.get('search'));
		const page = parsePageParam(searchParams.get('page'), 1);
		const pageSize = Math.min(parsePageParam(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

		const selectedRegionCodes = resolveRegionCodes(regionFilter);
		const normalizedSearch = normalizeSearchText(search);
		const normalizedGenFilter = normalizeSearchText(genFilter);

		const [sheetData, assignmentResult, sessionVideosResult, teacherStatsResult] = await Promise.all([
			getHrCandidateSheetData(false),
			pool.query(
				`SELECT candidate_key, assigned_gen
				 FROM hr_candidate_gen_assignments`
			),
			pool.query(
				`SELECT id, title, lesson_number, start_date
				 FROM training_videos
				 WHERE status IN ('active', 'published')
				 ORDER BY
					 CASE WHEN lesson_number IS NULL THEN 1 ELSE 0 END,
					 lesson_number ASC,
					 start_date ASC,
					 id ASC
				 LIMIT 4`
			),
			pool.query(
				`SELECT teacher_code, work_email
				 FROM training_teacher_stats`
			),
		]);

		const sessionVideos = sessionVideosResult.rows as SessionVideo[];
		const videoIds = sessionVideos.map((video) => video.id);

		const scoresResult = videoIds.length > 0
			? await pool.query(
					`SELECT teacher_code, video_id, score, completion_status, view_count, time_spent_seconds
					 FROM training_teacher_video_scores
					 WHERE video_id = ANY($1::int[])`,
					[videoIds]
				)
			: { rows: [] };

		const assignmentsByKey = new Map<string, HrAssignmentRow>();
		for (const row of assignmentResult.rows as HrAssignmentRow[]) {
			assignmentsByKey.set(row.candidate_key, row);
		}

		const teacherCodeByEmail = new Map<string, string>();
		const teacherCodes = new Set<string>();
		for (const row of teacherStatsResult.rows as TeacherStats[]) {
			const teacherCode = normalizeValue(row.teacher_code);
			const email = normalizeEmail(row.work_email);
			if (teacherCode) teacherCodes.add(teacherCode);
			if (teacherCode && email) teacherCodeByEmail.set(email, teacherCode);
		}

		const scoresMap = new Map<string, TeacherVideoScore>();
		for (const row of scoresResult.rows as TeacherVideoScore[]) {
			const teacherCode = normalizeValue(row.teacher_code);
			if (!teacherCode) continue;
			scoresMap.set(`${teacherCode}::${row.video_id}`, row);
		}

		const sessions = sessionVideos.map((video, index) => ({
			videoId: video.id,
			label: `Buổi ${index + 1}`,
			title: video.title,
			startDate: video.start_date,
		}));

		const filteredCandidates = sheetData.candidates
			.map((candidate) => {
				const assignment = assignmentsByKey.get(candidate.candidateKey);
				const manualGen = normalizeValue(assignment?.assigned_gen);
				const sheetGen = normalizeValue(candidate.sheetGen);
				const effectiveGen = manualGen || sheetGen;
				const regionCode = normalizeRegionCode(candidate.regionCode || '');

				const preferredTeacherCode = normalizeValue(candidate.candidateCode);
				const teacherCode = teacherCodes.has(preferredTeacherCode)
					? preferredTeacherCode
					: teacherCodeByEmail.get(normalizeEmail(candidate.email)) || '';

				const sessionResults = sessions.map((session) => {
					const scoreRow = teacherCode ? scoresMap.get(`${teacherCode}::${session.videoId}`) : undefined;
					return {
						videoId: session.videoId,
						label: session.label,
						score: toNumber(scoreRow?.score),
						attendance: hasAttendance(scoreRow),
						completionStatus: normalizeValue(scoreRow?.completion_status || 'not_started'),
					};
				});

				const scoredSessions = sessionResults.filter((item) => item.score !== null);
				const avgScore = scoredSessions.length > 0
					? Number((scoredSessions.reduce((sum, item) => sum + Number(item.score), 0) / scoredSessions.length).toFixed(2))
					: null;

				const attendanceCount = sessionResults.filter((item) => item.attendance).length;

				return {
					candidateKey: candidate.candidateKey,
					candidateCode: candidate.candidateCode,
					name: candidate.name,
					email: candidate.email,
					desiredCampus: candidate.desiredCampus,
					regionCode: regionCode || '',
					effectiveGen,
					teacherCode,
					attendanceCount,
					avgScore,
					sessions: sessionResults,
				};
			})
			.filter((candidate) => {
				if (!candidate.effectiveGen) return false;

				if (selectedRegionCodes) {
					const candidateRegionCode = normalizeRegionCode(candidate.regionCode);
					if (!candidateRegionCode || !selectedRegionCodes.includes(candidateRegionCode)) return false;
				}

				if (normalizedGenFilter && normalizedGenFilter !== 'all') {
					if (normalizeSearchText(candidate.effectiveGen) !== normalizedGenFilter) return false;
				}

				if (!normalizedSearch) return true;

				const searchableText = [
					candidate.candidateCode,
					candidate.name,
					candidate.email,
					candidate.effectiveGen,
					candidate.desiredCampus,
					candidate.teacherCode,
				]
					.map((value) => normalizeSearchText(value || ''))
					.join(' ');

				return searchableText.includes(normalizedSearch);
			})
			.sort((a, b) => {
				const genSort = a.effectiveGen.localeCompare(b.effectiveGen, 'vi', { numeric: true });
				if (genSort !== 0) return genSort;
				return (a.name || '').localeCompare(b.name || '', 'vi');
			});

		const genSummaryMap = filteredCandidates.reduce<Record<string, { total: number; attendanceTotal: number; scoreTotal: number; scoredCount: number }>>(
			(acc, candidate) => {
				if (!acc[candidate.effectiveGen]) {
					acc[candidate.effectiveGen] = { total: 0, attendanceTotal: 0, scoreTotal: 0, scoredCount: 0 };
				}

				acc[candidate.effectiveGen].total += 1;
				acc[candidate.effectiveGen].attendanceTotal += candidate.attendanceCount;
				if (candidate.avgScore !== null) {
					acc[candidate.effectiveGen].scoreTotal += candidate.avgScore;
					acc[candidate.effectiveGen].scoredCount += 1;
				}

				return acc;
			},
			{}
		);

		const genSummary = Object.entries(genSummaryMap)
			.map(([genCode, stats]) => ({
				genCode,
				totalCandidates: stats.total,
				avgAttendance: sessions.length > 0 ? Number((stats.attendanceTotal / stats.total).toFixed(2)) : 0,
				avgScore: stats.scoredCount > 0 ? Number((stats.scoreTotal / stats.scoredCount).toFixed(2)) : null,
			}))
			.sort((a, b) => b.totalCandidates - a.totalCandidates);

		const total = filteredCandidates.length;
		const totalPages = Math.max(1, Math.ceil(total / pageSize));
		const safePage = Math.min(page, totalPages);
		const start = (safePage - 1) * pageSize;
		const rows = filteredCandidates.slice(start, start + pageSize);

		return NextResponse.json({
			success: true,
			sessions,
			rows,
			genSummary,
			pagination: {
				page: safePage,
				pageSize,
				total,
				totalPages,
			},
			summary: {
				totalCandidates: total,
				totalGens: genSummary.length,
			},
		});
	} catch (error) {
		console.error('HR gen training GET error:', error);
		const message = error instanceof Error ? error.message : 'Lỗi không xác định';
		return NextResponse.json({ error: message }, { status: 500 });
	}
};

const handlePatch = async (request: NextRequest) => {
	try {
		const auth = await requireBearerSession(request);
		if (!auth.ok) return auth.response;

		const body = await request.json();
		const requestEmail = auth.sessionEmail;
		const teacherCode = normalizeValue(body.teacherCode);
		const updates = Array.isArray(body.updates) ? body.updates : [];

		if (!teacherCode || updates.length === 0) {
			return NextResponse.json(
				{ error: 'teacherCode và updates là bắt buộc.' },
				{ status: 400 }
			);
		}

		const access = await validateTrainingTabAccess(requestEmail);
		if (!access.ok) {
			return NextResponse.json({ error: access.message || 'Không có quyền truy cập.' }, { status: access.status });
		}

		const roleCodes = await getUserRoleCodes(requestEmail);
		if (!canEditTrainingTab(roleCodes)) {
			return NextResponse.json(
				{ error: 'Bạn không có quyền chỉnh sửa tab theo dõi GEN training.' },
				{ status: 403 }
			);
		}

		for (const update of updates as Array<{ videoId: unknown; score: unknown; attendance: unknown }>) {
			const videoId = Number(update.videoId);
			if (Number.isNaN(videoId) || videoId <= 0) continue;

			const rawScore = update.score;
			const scoreValue = rawScore === null || rawScore === undefined || rawScore === ''
				? null
				: Number(rawScore);
			const normalizedScore = scoreValue === null || Number.isNaN(scoreValue)
				? null
				: Math.max(0, Math.min(10, scoreValue));

			const attendance = Boolean(update.attendance);
			const completionStatus = attendance ? 'completed' : 'not_started';
			const viewCount = attendance ? 1 : 0;
			const timeSpentSeconds = attendance ? 1 : 0;

			await pool.query(
				`INSERT INTO training_teacher_video_scores
					(teacher_code, video_id, score, completion_status, view_count, time_spent_seconds, first_viewed_at, completed_at, updated_at)
				 VALUES
					($1, $2, $3, $4, $5, $6, CASE WHEN $5 > 0 THEN CURRENT_TIMESTAMP ELSE NULL END, CASE WHEN $4 = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END, CURRENT_TIMESTAMP)
				 ON CONFLICT (teacher_code, video_id)
				 DO UPDATE SET
					 score = EXCLUDED.score,
					 completion_status = EXCLUDED.completion_status,
					 view_count = EXCLUDED.view_count,
					 time_spent_seconds = EXCLUDED.time_spent_seconds,
					 first_viewed_at = CASE
						 WHEN training_teacher_video_scores.first_viewed_at IS NULL AND EXCLUDED.view_count > 0 THEN CURRENT_TIMESTAMP
						 ELSE training_teacher_video_scores.first_viewed_at
					 END,
					 completed_at = CASE
						 WHEN EXCLUDED.completion_status = 'completed' THEN CURRENT_TIMESTAMP
						 ELSE NULL
					 END,
					 updated_at = CURRENT_TIMESTAMP`,
				[teacherCode, videoId, normalizedScore, completionStatus, viewCount, timeSpentSeconds]
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('HR gen training PATCH error:', error);
		const message = error instanceof Error ? error.message : 'Lỗi không xác định';
		return NextResponse.json({ error: message }, { status: 500 });
	}
};

export const GET = withApiProtection(handleGet);
export const PATCH = withApiProtection(handlePatch);
