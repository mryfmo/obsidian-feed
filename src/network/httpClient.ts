import axios, {
  AxiosAdapter,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosInstance,
  AxiosHeaders,
  InternalAxiosRequestConfig,
  AxiosRequestHeaders,
} from 'axios';
import { requestUrl, RequestUrlParam } from 'obsidian';

const obsidianAdapter: AxiosAdapter = async (
  config: AxiosRequestConfig
): Promise<AxiosResponse<string>> => {
  const response = await requestUrl({
    url: config.url!,
    method: config.method?.toUpperCase(),
    headers: config.headers as Record<string, string> | undefined,
    body: config.data,
    timeout: config.timeout,
  } as RequestUrlParam);

  const internalConfig: InternalAxiosRequestConfig = {
    ...config,
    headers: (config.headers ? config.headers : new AxiosHeaders()) as AxiosRequestHeaders,
  };

  return {
    data: response.text,
    status: response.status,
    statusText: String(response.status),
    headers: response.headers,
    config: internalConfig,
    request: null,
  };
};

const corsAdapter: AxiosAdapter = async (
  config: AxiosRequestConfig
): Promise<AxiosResponse<string>> => {
  let target = config.url ?? '';
  if (!/^https?:\/\//i.test(target)) {
    target = `http://${target}`;
  }
  const proxied = `https://r.jina.ai/${encodeURIComponent(target)}`;
  const resp = await fetch(proxied, { method: 'GET' });
  const text = await resp.text();

  const responseHeaders: Record<string, string> = {};
  resp.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  const internalConfig: InternalAxiosRequestConfig = {
    ...config,
    headers: (config.headers ? config.headers : new AxiosHeaders()) as AxiosRequestHeaders,
  };

  return {
    data: text,
    status: resp.status,
    statusText: resp.statusText,
    headers: responseHeaders,
    config: internalConfig,
    request: resp,
  };
};

export function createHttpClient(): AxiosInstance {
  const hasRequestUrl = typeof window.require === 'function' && typeof requestUrl === 'function';

  const instance = axios.create({
    adapter: hasRequestUrl ? obsidianAdapter : undefined,
  });

  instance.interceptors.response.use(undefined, async error => {
    if (error.message?.includes('Network Error')) {
      return corsAdapter(error.config);
    }
    throw error;
  });

  return instance;
}
