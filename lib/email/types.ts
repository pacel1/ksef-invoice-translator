export interface EmailSendInput {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSendResult {
  data?: { id?: string } | null;
  error?: { message?: string } | null;
}

export type EmailSendFn = (input: EmailSendInput) => Promise<EmailSendResult>;
