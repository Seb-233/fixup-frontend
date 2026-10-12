import { GeocodingCandidate } from '../../../api/generated';

export type { GeocodingCandidate };

export type GeocodingState = 'idle' | 'geocoding' | 'candidates' | 'empty' | 'error';

export type GeocodingErrorType = 'invalid_query' | 'rate_limit' | 'service_unavailable' | 'unknown';

export interface GeocodingError {
  type: GeocodingErrorType;
  message: string;
}
