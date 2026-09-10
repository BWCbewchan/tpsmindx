# Checkout center filter design

## Problem

The center filter on `/user/checkout/manage` can return no rows when the
selected active center name differs from the historical `center_name` value
only by whitespace, punctuation, or a known legacy alias. The UI sends the
selected center correctly, but the API currently performs a strict
case-insensitive trimmed equality check.

## Goals

- Make the center filter match canonical and legacy center spellings.
- Preserve the existing active-center dropdown, combined filters, reset action,
  sorting, pagination limit, and loading/error behavior.
- Avoid changing unrelated checkout form behavior or stored historical data.

## Design

The API will normalize center names at filter time using a shared helper. The
normalization will:

1. Trim and collapse repeated whitespace.
2. Compare case-insensitively.
3. Apply the existing known center aliases/canonical names used when new
   checkout forms are submitted.

The `center` predicate will compare the normalized requested center with the
normalized database `center_name`. All other predicates remain unchanged and
continue to be joined with `AND`, so a center selection works together with
teacher, student, track, subject, and date filters.

The existing context endpoint remains the source of active center options.
No client-side filtering or fallback dataset will be introduced.

## Data flow

1. The user selects an active center in the manage page.
2. The page includes the selected center in the existing query string.
3. The forms API normalizes the requested value and applies the normalized
   center predicate alongside all other requested filters.
4. The API returns the filtered rows and total count using the existing
   response shape.

## Error handling

Existing authentication, validation, and database error handling remain
unchanged. A database/query error is surfaced through the existing API error
response and the page's existing error state; no silent fallback is added.

## Verification

- Exercise the API/UI path for a canonical center and a legacy spelling.
- Verify center filtering combined with at least one other filter.
- Verify reset clears the center and other filters.
- Run the repository's smallest relevant typecheck, lint, and test commands
  that already exist.
