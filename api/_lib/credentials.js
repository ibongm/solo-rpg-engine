/**
 * Parses GCP_SERVICE_ACCOUNT_KEY, which may be raw stringified JSON or Base64-encoded JSON.
 */
export function parseServiceAccount(raw) {
  if (!raw) throw new Error('GCP_SERVICE_ACCOUNT_KEY is not set.');
  const trimmed = String(raw).trim();
  let json;
  if (trimmed.startsWith('{')) {
    json = JSON.parse(trimmed);
  } else {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
    if (!decoded.startsWith('{')) throw new Error('GCP_SERVICE_ACCOUNT_KEY is neither JSON nor Base64-encoded JSON.');
    json = JSON.parse(decoded);
  }
  if (typeof json.private_key === 'string') json.private_key = json.private_key.replace(/\\n/g, '\n');
  if (!json.client_email || !json.private_key) throw new Error('Service account key is missing client_email/private_key.');
  return json;
}
