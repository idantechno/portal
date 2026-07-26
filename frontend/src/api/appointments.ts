import { api } from "./client";

export type AppointmentStatus =
  | "scheduled"
  | "cancelled"
  | "completed"
  | "no_show";

export type WaitlistStatus = "waiting" | "offered" | "booked" | "cancelled";

export interface Appointment {
  id: string;
  businessId: string;
  customerContactId: string | null;
  conversationId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  customerName: string | null;
  phone: string | null;
  notes: string | null;
  calendarEventId: string | null;
  source: "agent" | "manual";
  createdAt: string;
  updatedAt: string;
}

export interface WaitlistEntry {
  id: string;
  businessId: string;
  customerContactId: string | null;
  conversationId: string | null;
  service: string;
  customerName: string | null;
  phone: string | null;
  preferredFrom: string | null;
  preferredTo: string | null;
  notes: string | null;
  status: WaitlistStatus;
  offeredAt: string | null;
  offeredSlotStart: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentInput {
  title: string;
  start: string;
  end?: string;
  customerContactId?: string;
  customerName?: string;
  phone?: string;
  notes?: string;
}

export const appointmentsApi = {
  list: (
    businessId: string,
    opts: { from?: string; to?: string; status?: AppointmentStatus } = {},
  ) =>
    api
      .get<Appointment[]>(`/businesses/${businessId}/appointments`, {
        params: opts,
      })
      .then((r) => r.data),

  create: (businessId: string, input: CreateAppointmentInput) =>
    api
      .post<Appointment>(`/businesses/${businessId}/appointments`, input)
      .then((r) => r.data),

  cancel: (businessId: string, appointmentId: string) =>
    api
      .post<Appointment>(
        `/businesses/${businessId}/appointments/${appointmentId}/cancel`,
      )
      .then((r) => r.data),

  setStatus: (
    businessId: string,
    appointmentId: string,
    status: AppointmentStatus,
  ) =>
    api
      .patch<Appointment>(
        `/businesses/${businessId}/appointments/${appointmentId}/status`,
        { status },
      )
      .then((r) => r.data),
};

export const waitlistApi = {
  list: (businessId: string, opts: { status?: WaitlistStatus } = {}) =>
    api
      .get<WaitlistEntry[]>(`/businesses/${businessId}/waitlist`, {
        params: opts,
      })
      .then((r) => r.data),

  cancel: (businessId: string, entryId: string) =>
    api
      .post<WaitlistEntry>(
        `/businesses/${businessId}/waitlist/${entryId}/cancel`,
      )
      .then((r) => r.data),
};
