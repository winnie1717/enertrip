
export interface ItinerarySpot {
  DataType: "Spot";
  Day: number;
  Date: string;
  SpotName: string;
  Address: string;
  Latitude: number;
  Longitude: number;
  SpotType: string[];
  Description: string;
  Phone: string;
  Website: string;
  StartTime: string;
  EndTime: string;
  Rating: number;
  Cost: number;
  WalkingLoad: number;
  InfoLoad: number;
  CrowdLevel: number;
  IndoorOutdoor: "室內" | "戶外" | "半開放";
  WeatherType: string;
  Temperature: number;
}

export interface ItineraryTransport {
  DataType: "Transport";
  Day: number;
  TransportType: string;
  Distance: string;
  Duration: string;
  Speed: string;
  Cost: number;
}

export type ItineraryItem = ItinerarySpot | ItineraryTransport;

export interface Metrics {
  preference: number;
  physical: number;
  mental: number;
}

export interface DayItinerary {
  id: number;
  timestamp: string;
  result: ItineraryItem[];
}
