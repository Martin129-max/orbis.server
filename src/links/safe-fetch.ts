import { lookup, type LookupAddress } from 'node:dns';
import * as http from 'node:http';
import * as https from 'node:https';
import { BlockList, isIP } from 'node:net';

const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5000;
const USER_AGENT = 'Mozilla/5.0 (compatible; OrbisBot/1.0; link preview)';

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(address, prefix, 'ipv4');
}
for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(address, prefix, 'ipv6');
}

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 0) return false;
  return !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

function publicLookup(
  hostname: string,
  options: { all?: boolean; family?: number },
  callback: (
    error: Error | null,
    address?: string | LookupAddress[],
    family?: number,
  ) => void,
) {
  lookup(hostname, { family: options.family, all: true }, (error, found) => {
    if (error) return callback(error);
    if (
      found.length === 0 ||
      !found.every(({ address }) => isPublicAddress(address))
    ) {
      return callback(new Error('Address is not public'));
    }
    if (options.all) callback(null, found);
    else callback(null, found[0].address, found[0].family);
  });
}

function checkUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Unsupported protocol');
  }
  if (url.username || url.password) throw new Error('Credentials in URL');
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new Error('Unsupported port');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicAddress(host)) {
    throw new Error('Address is not public');
  }
}

export async function fetchHtml(
  target: string,
  redirects = MAX_REDIRECTS,
  contentType = /text\/html|application\/xhtml/i,
): Promise<{ url: string; html: string }> {
  const url = new URL(target);
  checkUrl(url);

  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const request = client.get(
      url,
      {
        lookup: publicLookup as unknown as http.RequestOptions['lookup'],
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'en',
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location) {
          response.resume();
          if (redirects === 0) return reject(new Error('Too many redirects'));
          resolve(
            fetchHtml(
              new URL(location, url).toString(),
              redirects - 1,
              contentType,
            ),
          );
          return;
        }

        const type = response.headers['content-type'] ?? '';
        if (status !== 200 || !contentType.test(type)) {
          response.resume();
          reject(new Error('Not an HTML page'));
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve({
            url: url.toString(),
            html: Buffer.concat(chunks).subarray(0, MAX_BYTES).toString('utf8'),
          });
        };
        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          size += chunk.length;
          if (size >= MAX_BYTES || /<\/head>/i.test(chunk.toString('latin1'))) {
            finish();
            response.destroy();
          }
        });
        response.on('end', finish);
        response.on('error', (error) => (done ? null : reject(error)));
      },
    );
    request.on('error', reject);
  });
}
