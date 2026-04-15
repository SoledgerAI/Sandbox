// NOT WIRED UP — scheduled for future sprint
// OpenWeatherMap current weather service
// Phase 18: Device Integrations
// Current conditions display on Dashboard (optional, small widget).
// Free tier: 1,000 calls/day.

import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage';

// ============================================================
// API constants
// ============================================================

const OWM_BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

// Cache key and TTL (30 minutes)
const WEATHER_CACHE_KEY = STORAGE_KEYS.WEATHER_CACHE;
const CACHE_TTL_MS = 30 * 60 * 1000;

// ============================================================
// Types
// ============================================================

export interface WeatherData {
  temperature_f: number;
  feels_like_f: number;
  humidity_pct: number;
  description: string;
  icon: string; // OWM icon code (e.g., "01d", "10n")
  wind_speed_mph: number;
  city_name: string;
  fetched_at: string; // ISO datetime
}

interface OWMResponse {
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
  };
  weather: Array<{
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number; // mph when units=imperial
  };
  name: string;
}

// ============================================================
// API key management
// ============================================================

let weatherApiKey = '';

/**
 * Set the OpenWeatherMap API key.
 * Users provide this in settings or it can be bundled in app config.
 */
export function setWeatherApiKey(key: string): void {
  weatherApiKey = key;
}

export function hasWeatherApiKey(): boolean {
  return weatherApiKey.length > 0;
}

// ============================================================
// Fetch current weather
// ============================================================

/**
 * Fetch current weather for the given coordinates.
 * Uses imperial units (Fahrenheit, mph).
 * Caches result for 30 minutes to respect free tier limits.
 */
export async function fetchCurrentWeather(lat: number, lon: number): Promise<WeatherData | null> {
  // Check cache first
  const cached = await storageGet<WeatherData>(WEATHER_CACHE_KEY);
  if (cached && isCacheValid(cached.fetched_at)) {
    return cached;
  }

  if (!weatherApiKey) {
    return cached ?? null; // Return stale cache if available, null otherwise
  }

  try {
    const url = `${OWM_BASE_URL}?lat=${lat}&lon=${lon}&appid=${weatherApiKey}&units=imperial`;
    const response = await fetch(url);

    if (!response.ok) {
      // Return stale cache on API error
      return cached ?? null;
    }

    const data: OWMResponse = await response.json();

    const weather: WeatherData = {
      temperature_f: Math.round(data.main.temp),
      feels_like_f: Math.round(data.main.feels_like),
      humidity_pct: data.main.humidity,
      description: data.weather[0]?.description ?? 'Unknown',
      icon: data.weather[0]?.icon ?? '01d',
      wind_speed_mph: Math.round(data.wind.speed),
      city_name: data.name,
      fetched_at: new Date().toISOString(),
    };

    // Cache the result
    await storageSet(WEATHER_CACHE_KEY, weather);

    return weather;
  } catch {
    // Network error -- return stale cache if available
    return cached ?? null;
  }
}

// ============================================================
// Helpers
// ============================================================

function isCacheValid(fetchedAt: string): boolean {
  const fetchTime = new Date(fetchedAt).getTime();
  return Date.now() - fetchTime < CACHE_TTL_MS;
}

/**
 * Map OWM icon code to an Ionicons icon name for display.
 */
export function weatherIconName(iconCode: string): string {
  const map: Record<string, string> = {
    '01d': 'sunny-outline',
    '01n': 'moon-outline',
    '02d': 'partly-sunny-outline',
    '02n': 'cloudy-night-outline',
    '03d': 'cloud-outline',
    '03n': 'cloud-outline',
    '04d': 'cloudy-outline',
    '04n': 'cloudy-outline',
    '09d': 'rainy-outline',
    '09n': 'rainy-outline',
    '10d': 'rainy-outline',
    '10n': 'rainy-outline',
    '11d': 'thunderstorm-outline',
    '11n': 'thunderstorm-outline',
    '13d': 'snow-outline',
    '13n': 'snow-outline',
    '50d': 'water-outline',
    '50n': 'water-outline',
  };
  return map[iconCode] ?? 'cloud-outline';
}

/**
 * Get a user-friendly weather summary string.
 */
export function weatherSummary(data: WeatherData): string {
  return `${data.temperature_f}°F · ${data.description}`;
}
