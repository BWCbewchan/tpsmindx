import { requireBearerSession } from '@/lib/datasource-api-auth';
import { callLmsApi } from '@/lib/lms-api';
import { getOrRefreshLmsToken, loginFallbackLmsAccount } from '@/lib/lms-token-helper';
import { isPortfolioAllowedUser } from '@/lib/menu-permissions';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import { NextRequest, NextResponse } from 'next/server';

const FIND_ONE_REWARD_POINT_QUERY = /* graphql */ `
  query findOneRewardPoint($studentId: String!) {
    findOneRewardPoint(payload: { productUserId_eq: $studentId }) {
      id
      currentPoint
      productUserId
    }
  }
`;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  try {
    const auth = await requireBearerSession(req);
    if (auth.ok === false) return auth.response;

    if (!isPortfolioAllowedUser(auth.resolvedAccess)) {
      return NextResponse.json(
        { success: false, error: 'Chỉ tài khoản TEGL, TEGL+, TM, CL, RL, AL, LEAD, TE, TC hoặc super_admin mới có quyền truy cập.' },
        { status: 403 },
      );
    }

    const rl = await rateLimitOr429Async(
      `student-reward-points:${clientIpFromRequest(req)}`,
      60,
      60_000,
    );
    if (rl) return rl;

    const { studentId } = await params;
    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'studentId is required' },
        { status: 400 },
      );
    }

    let tokenSession = await getOrRefreshLmsToken(req);
    let lmsAuthHeader = tokenSession.token ? `Bearer ${tokenSession.token}` : undefined;

    let resData;
    try {
      resData = await callLmsApi<{
        data: {
          findOneRewardPoint: {
            id?: string;
            currentPoint?: number;
            productUserId?: string;
          } | null;
        };
      }>(
        {
          query: FIND_ONE_REWARD_POINT_QUERY,
          operationName: 'findOneRewardPoint',
          variables: { studentId },
        },
        lmsAuthHeader,
      );
    } catch (err: any) {
      if (
        err?.message?.includes('Authentication token is missing') ||
        err?.message?.includes('jwt expired') ||
        err?.message?.includes('401')
      ) {
        tokenSession = await loginFallbackLmsAccount();
        if (tokenSession.token) {
          lmsAuthHeader = `Bearer ${tokenSession.token}`;
          resData = await callLmsApi<any>(
            {
              query: FIND_ONE_REWARD_POINT_QUERY,
              operationName: 'findOneRewardPoint',
              variables: { studentId },
            },
            lmsAuthHeader,
          );
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    const rewardPointObj = resData.data?.findOneRewardPoint;
    const currentPoint = Math.round(rewardPointObj?.currentPoint || 0);

    return NextResponse.json({
      success: true,
      data: {
        points: currentPoint,
        id: rewardPointObj?.id || null,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[student-reward-points] Error:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
