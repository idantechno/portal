/**
 * The JSON payload the public `/website-brief` form sends, carried as a single
 * stringified `payload` field inside the multipart request (alongside the logo
 * and image files). Parsed and validated by hand in the service — a multipart
 * text field doesn't flow through the global ValidationPipe like a JSON body.
 */
export interface IntakeAnswerItem {
  id?: string;
  label: string;
  value: string;
}

export interface IntakeAnswerSection {
  title: string;
  items: IntakeAnswerItem[];
}

export interface SubmitWebsiteIntakePayload {
  businessName: string;
  contactName: string;
  phone?: string;
  email?: string;
  sections: IntakeAnswerSection[];
  /** Honeypot — must be absent or empty; a filled value means a bot. */
  hp?: string;
}
