import { api } from "./client";

export interface NewsItem {
  title: string;
  link: string;
  source: string;
}
export interface WeatherNow {
  city: string;
  tempC: number;
  hi: number;
  lo: number;
  description: string;
  emoji: string;
}
export interface OverviewExtras {
  tip: string | null;
  news: NewsItem | null;
  weather: WeatherNow | null;
}

export const overviewApi = {
  get: (businessId: string) =>
    api
      .get<OverviewExtras>(`/businesses/${businessId}/overview`)
      .then((r) => r.data),
};
