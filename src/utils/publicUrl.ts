/**
 * Utility to generate public, unauthenticated URLs for Telão (TV/Projector) and Student Check-in.
 * 
 * In Google AI Studio preview:
 * - 'ais-dev-*.run.app' is the developer private container (requires Google account login).
 * - 'ais-pre-*.run.app' is the public preview / shared URL (opens instantly on ANY device WITHOUT login).
 * 
 * When deployed to production or custom domain, uses window.location.origin directly.
 */

export function getPublicBaseUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const origin = window.location.origin;

  // If in Google AI Studio dev container, automatically convert to public shared preview URL
  if (origin.includes('ais-dev-')) {
    return origin.replace('ais-dev-', 'ais-pre-');
  }

  return origin;
}

/**
 * Returns the public link to the Telão / TV Projection screen that opens without login.
 */
export function getPublicTelaoUrl(classId?: string, period?: string, sessionId?: string): string {
  const base = getPublicBaseUrl();
  const targetTurma = classId ? `&turma=${encodeURIComponent(classId)}` : '';
  const periodParam = period ? `&period=${encodeURIComponent(period)}` : '';
  const sessionParam = sessionId ? `&session=${encodeURIComponent(sessionId)}` : '';
  return `${base}/?portal=telao${targetTurma}${periodParam}${sessionParam}#telao`;
}

/**
 * Returns the public link for the Student Check-in portal (Anti-Fraude, no login required).
 */
export function getPublicStudentCheckinUrl(
  token?: string, 
  classId?: string, 
  mode: 'checkin' | 'card' = 'checkin',
  period?: string,
  sessionId?: string
): string {
  const base = getPublicBaseUrl();
  const tokenParam = token ? encodeURIComponent(token) : 'AUTO';
  const turmaParam = classId ? encodeURIComponent(classId) : '';
  const periodParam = period ? encodeURIComponent(period) : '';
  const sessionParam = sessionId ? encodeURIComponent(sessionId) : '';
  return `${base}/?portal=aluno&checkin=${tokenParam}${turmaParam ? `&turma=${turmaParam}` : ''}${periodParam ? `&period=${periodParam}` : ''}${sessionParam ? `&session=${sessionParam}` : ''}&mode=${mode}#aluno`;
}
