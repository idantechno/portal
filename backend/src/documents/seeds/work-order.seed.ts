import { DeliveryMode } from '../../common/enums/delivery-mode.enum';
import { WORK_ORDER_HTML } from './work-order.html';

export interface DocumentTemplateSeed {
  key: string;
  nameHe: string;
  version: number;
  deliveryMode: DeliveryMode;
  variableSchema: Record<string, unknown>;
  htmlTemplate: string;
}

export const WORK_ORDER_SEED: DocumentTemplateSeed = {
  key: 'work_order',
  nameHe: 'הזמנת עבודה',
  version: 1,
  deliveryMode: DeliveryMode.ClientSign,
  variableSchema: {
    type: 'object',
    required: [
      'client_name',
      'client_contact',
      'service_description',
      'total_amount',
      'currency',
      'requires_deposit',
      'start_date',
      'delivery_date',
    ],
    properties: {
      client_name: {
        type: 'string',
        descriptionHe: 'שם הלקוח',
      },
      client_contact: {
        type: 'string',
        descriptionHe: 'אמצעי קשר של הלקוח (טלפון או מייל)',
      },
      service_description: {
        type: 'string',
        descriptionHe: 'תיאור השירות שיינתן (נסה לסכם בכמה משפטים)',
      },
      total_amount: {
        type: 'number',
        minimum: 0,
        descriptionHe: 'סכום כולל בשקלים',
      },
      currency: {
        type: 'string',
        default: 'ILS',
        descriptionHe: 'מטבע (ברירת מחדל: ש״ח)',
      },
      requires_deposit: {
        type: 'boolean',
        descriptionHe: 'האם נדרשת מקדמה לפני תחילת העבודה',
      },
      deposit_amount: {
        type: 'number',
        minimum: 0,
        descriptionHe: 'סכום המקדמה (רק אם requires_deposit=true)',
      },
      start_date: {
        type: 'string',
        format: 'date',
        descriptionHe: 'תאריך תחילת העבודה (YYYY-MM-DD)',
      },
      delivery_date: {
        type: 'string',
        format: 'date',
        descriptionHe: 'תאריך סיום צפוי (YYYY-MM-DD)',
      },
      notes: {
        type: 'string',
        descriptionHe: 'הערות נוספות (אופציונלי)',
      },
    },
  },
  htmlTemplate: WORK_ORDER_HTML,
};
