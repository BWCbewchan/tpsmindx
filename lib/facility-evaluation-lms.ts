import { callLmsApi } from '@/lib/lms-api'

export type FacilityEvaluationCenterLike = {
  id: number
  full_name: string
  short_code: string | null
  display_name?: string | null
  region?: string | null
}

export type FacilityEvaluationLmsRecipient = {
  id: string
  centerId: number
  centerName: string
  centerShortCode: string | null
  centerRegion: string | null
  code: string | null
  fullName: string
  email: string | null
  roleCode: string
  roleName: string
  source: 'lms_users'
}

type LmsRole = {
  id: string
  name?: string | null
  description?: string | null
}

type LmsCentre = {
  id: string
  name?: string | null
  shortName?: string | null
  code?: string | null
  email?: string | null
  isActive?: boolean | null
}

type LmsUser = {
  id: string
  username?: string | null
  email?: string | null
  displayName?: string | null
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  isActive?: boolean | null
  createdAt?: string | null
  lastModifiedAt?: string | null
  roles?: LmsRole[] | null
  centres?: LmsCentre[] | null
}

type RecipientCandidate = FacilityEvaluationLmsRecipient & {
  lmsUserId: string
  identityKey: string
  userUpdatedAt: number
  userCenterCount: number
}

const LMS_PAGE_SIZE = 100
const LMS_MAX_PAGES = 10

const RECIPIENT_OVERRIDES = [
  {
    centerShortCode: '01TC',
    roleCode: 'CSL',
    email: 'thuyvtk@mindx.com.vn',
  },
] as const

const GET_LMS_CENTRES_QUERY = /* graphql */ `
  query GetFacilityEvaluationCentres($pageIndex: Int!, $itemsPerPage: Int!) {
    centres(payload: {
      isActive_eq: true,
      pageIndex: $pageIndex,
      itemsPerPage: $itemsPerPage
    }) {
      pagination { total }
      data { id name shortName code email isActive }
    }
  }
`

const GET_LMS_ROLES_QUERY = /* graphql */ `
  query GetFacilityEvaluationRoles($search: String!) {
    roles(payload: {
      filter_textSearch: $search,
      isActive_equals: true,
      pageIndex: 0,
      itemsPerPage: 50
    }) {
      data { id name description }
    }
  }
`

const GET_LMS_USERS_QUERY = /* graphql */ `
  query GetFacilityEvaluationUsers(
    $roles: [String],
    $centres: [String],
    $pageIndex: Int!,
    $itemsPerPage: Int!
  ) {
    users(payload: {
      roles_in: $roles,
      centres_in: $centres,
      isActive_equals: true,
      pageIndex: $pageIndex,
      itemsPerPage: $itemsPerPage
    }) {
      pagination { total }
      data {
        id
        username
        email
        displayName
        firstName
        middleName
        lastName
        isActive
        createdAt
        lastModifiedAt
        roles { id name description }
        centres { id name shortName code email isActive }
      }
    }
  }
`

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeKey(value: unknown): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function normalizeCode(value: unknown): string {
  return normalizeKey(value).replace(/^0+/, '')
}

function compactName(user: LmsUser): string {
  return (
    normalizeText(user.displayName) ||
    [user.firstName, user.middleName, user.lastName]
      .map(normalizeText)
      .filter(Boolean)
      .join(' ') ||
    normalizeText(user.email) ||
    normalizeText(user.username) ||
    normalizeText(user.id)
  )
}

function cleanRecipientName(value: unknown): string {
  let name = normalizeText(value).replace(/\s+/g, ' ')
  for (let index = 0; index < 3; index += 1) {
    name = name
      .replace(/^(CM|CSL|CXL|CXO|CS)\s+/i, '')
      .replace(/\s+(CM|CSL|CXL|CXO|CS)$/i, '')
      .replace(/^I\d{3,8}\s+/i, '')
      .replace(/\s+I\d{3,8}$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return name || normalizeText(value)
}

function roleCodeFromName(roleName: unknown): 'CM' | 'CSL' | null {
  const normalized = normalizeKey(roleName)
  if (normalized === 'cm') return 'CM'
  if (normalized.includes('csl') || normalized.includes('cxl')) return 'CSL'
  return null
}

function emailRank(email: string | null): number {
  const normalized = normalizeText(email).toLowerCase()
  if (normalized.endsWith('@mindx.com.vn')) return 0
  if (normalized.endsWith('@mindx.net.vn')) return 1
  if (normalized.endsWith('@mindx.edu.vn')) return 2
  return 3
}

function timestampValue(value: unknown): number {
  const text = normalizeText(value)
  if (!text) return 0
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function staffCodeKey(...values: unknown[]): string {
  const text = values.map(normalizeText).join(' ')
  const match = text.match(/\bI\d{3,8}\b/i)
  return match ? match[0].toUpperCase() : ''
}

function recipientIdentityKey(...values: unknown[]): string {
  const staffCode = staffCodeKey(...values)
  if (staffCode) return `staff:${staffCode}`

  const name = normalizeKey(values[0])
  if (name) return `name:${name}`

  const email = normalizeKey(values[1])
  if (email) return `email:${email}`

  const code = normalizeKey(values[2])
  if (code) return `code:${code}`

  return `user:${values.map(normalizeKey).filter(Boolean).join(':')}`
}

function recipientOverrideRank(candidate: RecipientCandidate): number {
  const candidateShortCode = normalizeCode(candidate.centerShortCode)
  const candidateEmail = normalizeText(candidate.email).toLowerCase()

  const matchedIndex = RECIPIENT_OVERRIDES.findIndex(
    (override) =>
      override.roleCode === candidate.roleCode &&
      normalizeCode(override.centerShortCode) === candidateShortCode &&
      override.email === candidateEmail,
  )

  return matchedIndex >= 0 ? matchedIndex : Number.MAX_SAFE_INTEGER
}

function compareRecipientCandidates(
  a: RecipientCandidate,
  b: RecipientCandidate,
): number {
  const overrideCompare = recipientOverrideRank(a) - recipientOverrideRank(b)
  if (overrideCompare !== 0) return overrideCompare

  const updatedCompare = b.userUpdatedAt - a.userUpdatedAt
  if (updatedCompare !== 0) return updatedCompare

  const centerCountCompare = a.userCenterCount - b.userCenterCount
  if (centerCountCompare !== 0) return centerCountCompare

  const emailCompare = emailRank(a.email) - emailRank(b.email)
  if (emailCompare !== 0) return emailCompare

  const nameCompare = a.fullName.localeCompare(b.fullName, 'vi')
  if (nameCompare !== 0) return nameCompare

  return a.lmsUserId.localeCompare(b.lmsUserId, 'vi')
}

function selectLatestRecipientCandidate(
  candidates: RecipientCandidate[],
): RecipientCandidate | null {
  if (candidates.length === 0) return null

  return [...candidates].sort(compareRecipientCandidates)[0]
}

function toRecipient(
  candidate: RecipientCandidate,
): FacilityEvaluationLmsRecipient {
  return {
    id: candidate.id,
    centerId: candidate.centerId,
    centerName: candidate.centerName,
    centerShortCode: candidate.centerShortCode,
    centerRegion: candidate.centerRegion,
    code: candidate.code,
    fullName: candidate.fullName,
    email: candidate.email,
    roleCode: candidate.roleCode,
    roleName: candidate.roleName,
    source: candidate.source,
  }
}

function centerMatchesLmsCentre(
  center: FacilityEvaluationCenterLike,
  lmsCentre: LmsCentre,
): boolean {
  const localNames = [
    center.full_name,
    center.display_name,
  ]
    .map(normalizeKey)
    .filter(Boolean)
  const localCodes = [center.short_code].map(normalizeCode).filter(Boolean)

  const lmsNames = [
    lmsCentre.name,
    lmsCentre.shortName,
    lmsCentre.code,
    lmsCentre.email,
  ]
    .map(normalizeKey)
    .filter(Boolean)
  const lmsCodes = [lmsCentre.shortName, lmsCentre.code]
    .map(normalizeCode)
    .filter(Boolean)

  if (
    localCodes.some((localCode) =>
      lmsCodes.some(
        (lmsCode) =>
          localCode === lmsCode ||
          (localCode.length >= 2 && lmsCode.endsWith(localCode)),
      ),
    )
  ) {
    return true
  }

  return localNames.some((localName) =>
    lmsNames.some((lmsName) => {
      if (localName === lmsName) return true
      return (
        localName.length >= 5 &&
        lmsName.length >= 5 &&
        (localName.includes(lmsName) || lmsName.includes(localName))
      )
    }),
  )
}

async function fetchAllLmsCentres(authHeader?: string): Promise<LmsCentre[]> {
  const first = await callLmsApi<{
    data?: { centres?: { data?: LmsCentre[]; pagination?: { total?: number } } }
  }>(
    {
      query: GET_LMS_CENTRES_QUERY,
      operationName: 'GetFacilityEvaluationCentres',
      variables: { pageIndex: 0, itemsPerPage: LMS_PAGE_SIZE },
    },
    authHeader,
  )

  const firstPage = first.data?.centres
  const centres = Array.isArray(firstPage?.data) ? [...firstPage.data] : []
  const total = Number(firstPage?.pagination?.total || centres.length)
  const totalPages = Math.min(Math.ceil(total / LMS_PAGE_SIZE), LMS_MAX_PAGES)

  for (let pageIndex = 1; pageIndex < totalPages; pageIndex += 1) {
    const page = await callLmsApi<{
      data?: { centres?: { data?: LmsCentre[] } }
    }>(
      {
        query: GET_LMS_CENTRES_QUERY,
        operationName: 'GetFacilityEvaluationCentres',
        variables: { pageIndex, itemsPerPage: LMS_PAGE_SIZE },
      },
      authHeader,
    )
    const rows = page.data?.centres?.data
    if (!Array.isArray(rows) || rows.length === 0) break
    centres.push(...rows)
  }

  return centres
}

async function fetchRecipientRoles(authHeader?: string) {
  const roleMap = new Map<string, { roleCode: 'CM' | 'CSL'; roleName: string }>()

  for (const search of ['CM', 'CSL']) {
    const result = await callLmsApi<{
      data?: { roles?: { data?: LmsRole[] } }
    }>(
      {
        query: GET_LMS_ROLES_QUERY,
        operationName: 'GetFacilityEvaluationRoles',
        variables: { search },
      },
      authHeader,
    )
    ;(result.data?.roles?.data || []).forEach((role) => {
      const roleCode = roleCodeFromName(role.name)
      if (!role.id || !roleCode) return
      roleMap.set(role.id, {
        roleCode,
        roleName: normalizeText(role.name) || roleCode,
      })
    })
  }

  return roleMap
}

async function fetchLmsUsersByRolesAndCentres(
  roleIds: string[],
  lmsCentreIds: string[],
  authHeader?: string,
): Promise<LmsUser[]> {
  if (roleIds.length === 0 || lmsCentreIds.length === 0) return []

  const users: LmsUser[] = []
  let totalPages = 1

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const result = await callLmsApi<{
      data?: { users?: { data?: LmsUser[]; pagination?: { total?: number } } }
    }>(
      {
        query: GET_LMS_USERS_QUERY,
        operationName: 'GetFacilityEvaluationUsers',
        variables: {
          roles: roleIds,
          centres: lmsCentreIds,
          pageIndex,
          itemsPerPage: LMS_PAGE_SIZE,
        },
      },
      authHeader,
    )

    const page = result.data?.users
    const rows = Array.isArray(page?.data) ? page.data : []
    users.push(...rows)

    if (pageIndex === 0) {
      const total = Number(page?.pagination?.total || rows.length)
      totalPages = Math.min(Math.ceil(total / LMS_PAGE_SIZE), LMS_MAX_PAGES)
    }

    if (rows.length === 0) break
  }

  return users
}

export async function fetchFacilityEvaluationLmsRecipients(
  centers: FacilityEvaluationCenterLike[],
  authHeader?: string,
): Promise<FacilityEvaluationLmsRecipient[]> {
  if (centers.length === 0) return []

  const [lmsCentres, roleMap] = await Promise.all([
    fetchAllLmsCentres(authHeader),
    fetchRecipientRoles(authHeader),
  ])
  const roleIds = Array.from(roleMap.keys())
  if (roleIds.length === 0) return []

  const localByLmsCentreId = new Map<string, FacilityEvaluationCenterLike[]>()
  centers.forEach((center) => {
    lmsCentres.forEach((lmsCentre) => {
      if (!centerMatchesLmsCentre(center, lmsCentre)) return
      const current = localByLmsCentreId.get(lmsCentre.id) || []
      current.push(center)
      localByLmsCentreId.set(lmsCentre.id, current)
    })
  })

  const lmsCentreIds = Array.from(localByLmsCentreId.keys())
  const lmsUsers = await fetchLmsUsersByRolesAndCentres(
    roleIds,
    lmsCentreIds,
    authHeader,
  )

  const candidatesByIdentity = new Map<string, RecipientCandidate[]>()
  const seen = new Set<string>()

  lmsUsers.forEach((user) => {
    if (user.isActive !== true) return

    const userName = compactName(user)
    const userEmail = normalizeText(user.email) || null
    const userUpdatedAt =
      timestampValue(user.lastModifiedAt) || timestampValue(user.createdAt)
    const userCenterCount = (user.centres || []).length
    const userRoles = (user.roles || [])
      .map((role) => {
        const matched = roleMap.get(role.id)
        if (!matched) return null
        return {
          ...matched,
          lmsRoleId: role.id,
        }
      })
      .filter(Boolean) as Array<{
      roleCode: 'CM' | 'CSL'
      roleName: string
      lmsRoleId: string
    }>

    if (userRoles.length === 0) return

    ;(user.centres || []).forEach((lmsCentre) => {
      const localCenters = localByLmsCentreId.get(lmsCentre.id) || []
      localCenters.forEach((center) => {
        userRoles.forEach((role) => {
          const centerRoleKey = `${center.id}:${role.roleCode}`
          const key = `${center.id}:${user.id}:${role.roleCode}`
          if (seen.has(key)) return
          seen.add(key)

          const candidate: RecipientCandidate = {
            id: `lms_user:${user.id}:${role.roleCode}:${center.id}`,
            centerId: Number(center.id),
            centerName: normalizeText(center.full_name),
            centerShortCode: normalizeText(center.short_code) || null,
            centerRegion: normalizeText(center.region) || null,
            code: normalizeText(user.username) || null,
            fullName: cleanRecipientName(userName),
            email: userEmail,
            roleCode: role.roleCode,
            roleName: role.roleName,
            source: 'lms_users',
            lmsUserId: user.id,
            identityKey: recipientIdentityKey(
              cleanRecipientName(userName),
              userEmail,
              user.username,
              userName,
            ),
            userUpdatedAt,
            userCenterCount,
          }
          const identityKey = `${centerRoleKey}:${candidate.identityKey}`
          const current = candidatesByIdentity.get(identityKey) || []
          current.push(candidate)
          candidatesByIdentity.set(identityKey, current)
        })
      })
    })
  })

  const recipients = Array.from(candidatesByIdentity.values())
    .map(selectLatestRecipientCandidate)
    .filter(
      (candidate): candidate is RecipientCandidate => candidate !== null,
    )
    .map(toRecipient)

  return recipients.sort((a, b) => {
    const centerCompare = a.centerName.localeCompare(b.centerName, 'vi')
    if (centerCompare !== 0) return centerCompare
    const roleCompare = a.roleCode.localeCompare(b.roleCode, 'vi')
    if (roleCompare !== 0) return roleCompare
    return a.fullName.localeCompare(b.fullName, 'vi')
  })
}
