// Types and constants that can be used client-side
export interface SurveyFormData {
  gender: string;
  roomWithDifferentGender: boolean;
  housingRegion: string;
  housingCities: string[];
  internshipStartDate: string;
  internshipEndDate: string;
  desiredRoommates: string;
  monthlyBudget: number;
  nonNegotiables: string[];
  additionalNotes: string;
  submitted: boolean;
}

export const HOUSING_REGIONS = {
  "Bay Area": ["San Francisco", "San Jose", "Oakland", "Palo Alto", "Mountain View", "Cupertino", "Sunnyvale", "Santa Clara"],
  "Seattle Area": ["Seattle", "Bellevue", "Redmond", "Kirkland"],
  "New York City Area": ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"],
  "Austin Area": ["Austin", "Round Rock", "Cedar Park"],
  "Other": ["Other"]
};

export const NON_NEGOTIABLES = [
  "Cleanliness", 
  "Quiet Hours", 
  "No Smoking", 
  "No Alcohol", 
  "Pet-Free", 
  "Religious Preferences",
  "Gender",
  "Sexual Orientation",
  "Diet Restrictions",
  "Early Riser",
  "Night Owl"
]; 