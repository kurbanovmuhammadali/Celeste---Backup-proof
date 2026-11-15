/**
 * Browsers only create navigator.mediaDevices on https:// pages (or localhost). Over plain http on a phone it is missing,
 * which used to surface as a raw JavaScript error. This explains it and points at the https address of this server.
 */
export const cameraAvailable = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export function cameraHelp(): string {
  if (typeof location === 'undefined') return 'The camera is not available here.';
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (location.protocol === 'http:' && !local) {
    return `The browser blocks the camera on plain http. Open the secure address instead: https://${location.hostname}:4443${location.pathname} (accept the certificate warning once: Advanced, then Continue).`;
  }
  return 'This browser does not allow camera access here. Use a current Chrome or Safari, and open the page over https.';
}
