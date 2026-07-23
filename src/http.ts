import { requestUrl } from 'obsidian';

export interface HttpRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | ArrayBuffer;
}

export interface HttpResponse {
  status: number;
  text: string;
  arrayBuffer?: ArrayBuffer;
  json<T = unknown>(): T;
}

export type HttpFn = (req: HttpRequest) => Promise<HttpResponse>;

/** Transport basé sur requestUrl d'Obsidian (contourne le CORS de la webview mobile).
 *  throw: false => on lit le status nous-mêmes au lieu de lever sur 4xx/5xx. */
export const obsidianHttp: HttpFn = async (req) => {
  const res = await requestUrl({
    url: req.url,
    method: req.method ?? 'GET',
    headers: req.headers,
    body: req.body,
    throw: false,
  });
  return {
    status: res.status,
    arrayBuffer: res.arrayBuffer,
    text: res.text,
    json<T = unknown>(): T {
      return JSON.parse(res.text) as T;
    },
  };
};
