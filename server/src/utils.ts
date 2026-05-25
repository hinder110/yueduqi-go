import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import http from 'http';
import https from 'https';
import iconv from 'iconv-lite';

export const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';

const keepAliveAgent = new http.Agent({ keepAlive: true });
const keepAliveAgentTls = new https.Agent({ keepAlive: true });

export const httpClient: AxiosInstance = axios.create({
  timeout: 15000,
  httpAgent: keepAliveAgent,
  httpsAgent: keepAliveAgentTls,
  headers: {
    'User-Agent': USER_AGENT,
  },
});

export function toAbsUrl(path: string, base: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return base + path;
  return base + '/' + path;
}

export interface FetchHTMLOptions {
  referer: string;
  encoding?: string;
  body?: Buffer;
  method?: 'GET' | 'POST';
}

export async function fetchHTML(url: string, opts: FetchHTMLOptions): Promise<cheerio.CheerioAPI> {
  const isPost = opts.method === 'POST';
  const response = await axios({
    url,
    method: isPost ? 'POST' : 'GET',
    data: isPost && opts.body ? opts.body : undefined,
    timeout: 15000,
    responseType: 'arraybuffer',
    httpAgent: keepAliveAgent,
    httpsAgent: keepAliveAgentTls,
    headers: {
      'User-Agent': USER_AGENT,
      Referer: opts.referer,
      ...(isPost && opts.body
        ? {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': String(opts.body.length),
          }
        : {}),
    },
  });

  const buf = Buffer.from(response.data);
  const html = iconv.decode(buf, opts.encoding ?? 'utf8');
  return cheerio.load(html);
}
