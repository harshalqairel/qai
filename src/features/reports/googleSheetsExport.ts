import type { FinancialReport } from "./financialReport";
import { reportFilePeriodLabel } from "./financialReport";
import { buildFinancialReportWorkbook, XLSX_MIME } from "./excelExport";

type GoogleTokenResponse = { access_token?: string; error?: string };
type GoogleTokenClient = { requestAccessToken: (options?: { prompt?: string }) => void };
export const GOOGLE_REPORT_SCOPE = "https://www.googleapis.com/auth/drive.file";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (error: unknown) => void;
          }) => GoogleTokenClient;
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
}

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-qai-google-identity="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Google sign-in.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.qaiGoogleIdentity = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google sign-in."));
    document.head.appendChild(script);
  });
}

async function requestDriveFileToken(clientId: string): Promise<string> {
  await loadGoogleIdentityServices();
  return new Promise((resolve, reject) => {
    const client = window.google?.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_REPORT_SCOPE,
      callback: (response) => {
        if (response.access_token) resolve(response.access_token);
        else reject(new Error(response.error || "Google authorization was not completed."));
      },
      error_callback: () => reject(new Error("Google authorization was cancelled.")),
    });
    if (!client) {
      reject(new Error("Google authorization is unavailable."));
      return;
    }
    client.requestAccessToken({ prompt: "consent" });
  });
}

export async function exportFinancialReportToGoogleSheets(report: FinancialReport): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw new Error("Google Sheets export is not configured.");
  const accessToken = await requestDriveFileToken(clientId);
  return uploadFinancialReportWorkbookToGoogleSheets(report, accessToken);
}

export async function exportFinancialReportToGoogleDrive(report: FinancialReport): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw new Error("Google Drive export is not configured.");
  const accessToken = await requestDriveFileToken(clientId);
  return uploadFinancialReportWorkbookToGoogleDrive(report, accessToken);
}

export async function uploadFinancialReportWorkbookToGoogleSheets(
  report: FinancialReport,
  accessToken: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<string> {
  const bytes = await buildFinancialReportWorkbook(report);
  const boundary = `qai_${crypto.randomUUID()}`;
  const metadata = {
    name: `Qai Financial Report — ${reportFilePeriodLabel(report)}`,
    mimeType: "application/vnd.google-apps.spreadsheet",
  };
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${XLSX_MIME}\r\n\r\n`,
    bytes,
    `\r\n--${boundary}--`,
  ]);
  const response = await fetchImplementation(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (response.status === 401 || response.status === 403) throw new Error("Google Drive access was not granted. Try again and approve report export access.");
  if (!response.ok) throw new Error("Google Sheets could not create the report.");
  const result = await response.json() as { id?: string; webViewLink?: string };
  if (result.webViewLink) return result.webViewLink;
  if (result.id) return `https://docs.google.com/spreadsheets/d/${result.id}/edit`;
  throw new Error("Google Sheets did not return a spreadsheet link.");
}

export async function uploadFinancialReportWorkbookToGoogleDrive(
  report: FinancialReport,
  accessToken: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<string> {
  const bytes = await buildFinancialReportWorkbook(report);
  const boundary = `qai_${crypto.randomUUID()}`;
  const metadata = { name: `Qai Financial Report — ${reportFilePeriodLabel(report)}.xlsx`, mimeType: XLSX_MIME };
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${XLSX_MIME}\r\n\r\n`,
    bytes,
    `\r\n--${boundary}--`,
  ]);
  const response = await fetchImplementation("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (response.status === 401 || response.status === 403) throw new Error("Google Drive access was not granted. Try again and approve report export access.");
  if (!response.ok) throw new Error("Google Drive could not save the report.");
  const result = await response.json() as { id?: string; webViewLink?: string };
  if (result.webViewLink) return result.webViewLink;
  if (result.id) return `https://drive.google.com/file/d/${result.id}/view`;
  throw new Error("Google Drive did not return a file link.");
}
