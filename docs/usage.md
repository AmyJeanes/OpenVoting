# Usage Guide

## Poll lifecycle

Polls move through these states:

1. Draft
2. Submission Open
3. Review
4. Voting Open
5. Closed

The submission and voting phases can be configured to end automatically at a set date/time or be manually progressed by an admin. During the review stage after submission closes, admins can inspect entries, disqualify entries that violate rules, and make final adjustments before voting opens.

## Voting methods

- `Approval` voting (select up to max choices)
- `IRV` (Instant Runoff Voting) with ranked choices

IRV allows voters to rank preferences. The backend computes winners using elimination rounds until a winner emerges with majority support.

## Entry and image handling

- Per-poll field requirements: title/description/image can be Off, Optional, or Required
- Server-side image validation (must be image, size-limited, square, minimum dimensions)
- Derived public image asset generation
- BlurHash-based teaser generation for pre-voting preview mode

## Eligibility and moderation

- Discord guild membership required to authenticate
- Optional admin-role based privileges
- Optional poll-level role requirements and join-date cutoff checks
- Member ban handling
- Entry disqualify/requalify flows with audit metadata

## Member flow

1. Open the app in your browser
2. Sign in with Discord
3. Browse live polls
4. Submit entries (when submission is open and allowed)
5. Vote during voting phase
6. Review results in past polls after closure

## Discord one-time login flow

The app supports a Discord slash command login path:

1. In your Discord server, run `/voting`
2. Open the generated one-time login link
3. Confirm sign-in in the web app

The one-time link is short-lived and single-use.

## Admin flow

Admins can:

- Create polls
- Configure poll metadata and field requirements
- Configure submission and voting settings
- Progress poll lifecycle stages
- Disqualify/requalify entries
- Inspect voting tallies during `Review` and `VotingOpen`
- Delete polls and related assets