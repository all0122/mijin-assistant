const SCOPES = "https://www.googleapis.com/auth/calendar";
const DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let gapiInited = false;
let gisInited = false;

export function getClientId(): string {
  return localStorage.getItem("google_client_id") || "";
}

export function getAccessToken(): string {
  return localStorage.getItem("google_access_token") || "";
}

export function isConnected(): boolean {
  return !!getAccessToken() && !!getClientId();
}

export async function initGapi(): Promise<void> {
  return new Promise((resolve) => {
    gapi.load("client", async () => {
      await gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
      const token = getAccessToken();
      if (token) gapi.client.setToken({ access_token: token });
      gapiInited = true;
      resolve();
    });
  });
}

export function initGis(clientId: string): void {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.access_token) {
        localStorage.setItem("google_access_token", resp.access_token);
        gapi.client.setToken({ access_token: resp.access_token });
        window.dispatchEvent(new Event("google-auth-changed"));
      }
    },
  });
  gisInited = true;
}

export function requestToken(): void {
  if (!tokenClient) return;
  tokenClient.requestAccessToken({ prompt: "" });
}

export function disconnect(): void {
  const token = getAccessToken();
  if (token) google.accounts.oauth2.revoke(token, () => {});
  localStorage.removeItem("google_access_token");
  gapi.client.setToken(null);
  window.dispatchEvent(new Event("google-auth-changed"));
}

export interface GCalEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  colorId?: string;
}

export async function fetchEvents(
  timeMin: string,
  timeMax: string,
): Promise<{ events: GCalEvent[]; error?: string }> {
  if (!isConnected()) return { events: [] };
  if (!gapiInited) return { events: [], error: "GAPI_NOT_READY" };
  try {
    const resp = await gapi.client.calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });
    return { events: (resp.result.items as GCalEvent[]) || [] };
  } catch (e: unknown) {
    const err = e as {
      status?: number;
      result?: { error?: { message?: string } };
    };
    if (err.status === 401) {
      localStorage.removeItem("google_access_token");
      window.dispatchEvent(new Event("google-auth-changed"));
      return { events: [], error: "TOKEN_EXPIRED" };
    }
    if (err.status === 403) {
      const msg = err.result?.error?.message || "403 Forbidden";
      console.error("Google Calendar 403:", JSON.stringify(e));
      return { events: [], error: `403: ${msg}` };
    }
    console.error("Google Calendar error:", JSON.stringify(e));
    return { events: [], error: err.result?.error?.message || "UNKNOWN" };
  }
}

export async function createEvent(event: {
  title: string;
  description?: string;
  location?: string;
  start: string;
  end?: string;
}): Promise<GCalEvent | null> {
  if (!isConnected()) return null;
  const body = {
    summary: event.title,
    description: event.description,
    location: event.location,
    start: event.end
      ? { dateTime: event.start, timeZone: "Asia/Seoul" }
      : { date: event.start.slice(0, 10) },
    end: event.end
      ? { dateTime: event.end, timeZone: "Asia/Seoul" }
      : { date: event.start.slice(0, 10) },
  };
  const resp = await gapi.client.calendar.events.insert({
    calendarId: "primary",
    resource: body,
  });
  return resp.result as GCalEvent;
}

export async function deleteEvent(eventId: string): Promise<void> {
  await gapi.client.calendar.events.delete({ calendarId: "primary", eventId });
}
