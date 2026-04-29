// Strava API configuration
// Sprint 11: Strava OAuth integration
// Sprint S34-A: Migrated to PKCE — no client_secret required.
// Set STRAVA_CLIENT_ID as an env var in eas.json or a local .env file.
// Register at https://www.strava.com/settings/api with the redirect
// URI below.

export const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID ?? 'PLACEHOLDER';
export const STRAVA_REDIRECT_URI = 'dubaitracker://strava-callback';
