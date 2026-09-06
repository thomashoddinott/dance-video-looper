import { DriveError } from './driveApi'

/* Google answers a dead token and a revoked grant with the same 401, so on the
   face of it this cannot tell them apart. What makes it safe is upstream: the
   session retires a token 30 seconds before it expires (`session.ts`), so a
   token that was live when a call started is still live when it lands. An
   expiry therefore does not reach Drive as a 401 — and what is left is the
   dancer having removed access in their Google account, which is a thing they
   can act on and `DriveStatus` already has a sentence for.

   Everything else stays a plain failure. A 403 means the grant stands and
   something else refused; a 5xx is Google's bad minute; a dropped connection is
   a studio with bad signal, which UC-01 *c makes the expected case rather than
   the edge. Reporting any of those as "your access was removed" would be the
   app blaming the dancer for the room. */
export const withdrewConsent = (error: unknown) =>
  error instanceof DriveError && error.status === 401
