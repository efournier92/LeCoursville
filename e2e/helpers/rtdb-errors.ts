import { Page } from '@playwright/test';

/**
 * Fails the first RTDB query for `path` with a permission_denied frame, then
 * proxies every later query so a retry can recover. The browser SDK surfaces
 * the frame through the listener's error callback, not a console error.
 */
export async function failNextRtdbQuery(page: Page, path: string): Promise<void> {
  let failed = false;
  await page.routeWebSocket(/ws:\/\/[^/]*:9000\/.*/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => {
      const text = message.toString();
      let queryPath: string | undefined;
      let requestId: number | undefined;
      try {
        const parsed = JSON.parse(text);
        queryPath = parsed?.d?.b?.p;
        requestId = parsed?.d?.r;
      } catch {
        // Not a protocol frame; forward it untouched.
      }
      if (!failed && queryPath === path && requestId !== undefined) {
        failed = true;
        ws.send(JSON.stringify({
          t: 'd',
          d: { r: requestId, b: { s: 'permission_denied', d: 'forced e2e failure' } },
        }));
        return;
      }
      server.send(message);
    });
  });
}
