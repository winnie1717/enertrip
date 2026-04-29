
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
  WeatherType: "陰天" | "多雲" | "晴到多雲" | "晴天" | "炎熱晴天" | "雨天";
  Temperature: number;
  // Fix: Added missing optional property present in constants.ts data
  IsRealCoordinate?: boolean;
}

export interface ItineraryTransport {
  DataType: "Transport";
  Day: number;
  TransportType: "步行" | "腳踏車" | "汽車" | "公車" | "火車" | "高鐵";
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
