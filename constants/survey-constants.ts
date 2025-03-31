// Types and constants that can be used client-side
export interface SurveyFormData {
  gender: string;
  roomWithDifferentGender: boolean;
  housingRegion: string;
  housingCities: string[];
  internshipStartDate: string;
  internshipEndDate: string;
  internshipCompany: string;
  sameCompanyOnly: boolean;
  desiredRoommates: string;
  monthlyBudget: number;
  preferences: Record<string, PreferenceRating>;
  additionalNotes: string;
  submitted: boolean;
}

export type PreferenceRating = "must_have" | "prefer" | "neutral" | "prefer_not" | "deal_breaker";

export const PREFERENCE_ITEMS = [
  "Okay with smoking/vaping",
  "Okay with alcohol",
  "Okay with pets",
  "Okay with guests",
  "Okay with overnight guests",
  "LGBTQ-friendly",
];

export const PREFERENCE_LABELS: Record<PreferenceRating, string> = {
  "must_have": "Must-have",
  "prefer": "Prefer",
  "neutral": "Neutral",
  "prefer_not": "Prefer not",
  "deal_breaker": "Deal-breaker"
};

export const HOUSING_REGIONS = {
  "Bay Area": ["San Francisco", "San Jose", "Oakland", "Palo Alto", "Mountain View", "Cupertino", "Sunnyvale", "Santa Clara"],
  "Seattle Area": ["Seattle", "Bellevue", "Redmond", "Kirkland"],
  "New York City Area": ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"],
  "Austin Area": ["Austin", "Round Rock", "Cedar Park"],
  "Other": ["Other"]
};