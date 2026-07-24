import { IntegrationProvider } from './integration.entity';

export interface IntegrationProviderDef {
  provider: IntegrationProvider;
  name: string;
  description: string;
  /** Icon slug resolved by the frontend icon set (see components/icons.tsx). */
  icon: string;
  /** Google OAuth scopes requested when connecting this provider. */
  scopes: string[];
}

export const INTEGRATION_PROVIDERS: readonly IntegrationProviderDef[] = [
  {
    provider: 'gmail',
    name: 'Gmail',
    description: 'שליחה וקריאה של מיילים מתוך המערכת.',
    icon: 'mail',
    scopes: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
  },
  {
    provider: 'calendar',
    name: 'Google Calendar',
    description: 'קביעת פגישות וסנכרון זמינות.',
    icon: 'calendar',
    // events: read/write events on all accessible calendars (incl. shared ones);
    // calendarlist.readonly: list the account's calendars so shared calendars
    // (e.g. a personal calendar shared into this account) can be discovered.
    scopes: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    ],
  },
  {
    provider: 'drive',
    name: 'Google Drive',
    description: 'שמירה וקריאה של מסמכים וקבצים.',
    icon: 'folder',
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
