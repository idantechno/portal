import { IntegrationProvider } from './integration.entity';

export interface IntegrationProviderDef {
  provider: IntegrationProvider;
  name: string;
  description: string;
  icon: string;
  /** Google OAuth scopes requested when connecting this provider. */
  scopes: string[];
}

export const INTEGRATION_PROVIDERS: readonly IntegrationProviderDef[] = [
  {
    provider: 'gmail',
    name: 'Gmail',
    description: 'שליחה וקריאה של מיילים מתוך המערכת.',
    icon: '✉️',
    scopes: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
  },
  {
    provider: 'calendar',
    name: 'Google Calendar',
    description: 'קביעת פגישות וסנכרון זמינות.',
    icon: '📅',
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
  },
  {
    provider: 'drive',
    name: 'Google Drive',
    description: 'שמירה וקריאה של מסמכים וקבצים.',
    icon: '🗂️',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  },
];

export function getProviderDef(
  provider: string,
): IntegrationProviderDef | undefined {
  return INTEGRATION_PROVIDERS.find((p) => p.provider === provider);
}

export function isIntegrationProvider(v: string): v is IntegrationProvider {
  return INTEGRATION_PROVIDERS.some((p) => p.provider === v);
}
