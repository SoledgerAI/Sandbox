// Strava API configuration
// Sprint 11: Strava OAuth integration
// Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET as env vars in eas.json
// or a local .env file. Register at https://www.strava.com/settings/api

export const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID ?? 'PLACEHOLDER';
export const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET ?? 'PLACEHOLDER';
export const STRAVA_REDIRECT_URI = 'dubaitracker://strava-callback';
