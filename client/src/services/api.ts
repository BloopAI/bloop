import axios, { AxiosInstance } from 'axios';
import {
  AllConversationsResponse,
  ConversationType,
  FileResponse,
  HoverablesResponse,
  NLSearchResponse,
  SearchResponse,
  SuggestionsResponse,
  TokenInfoResponse,
} from '../types/api';
import { RepoType } from '../types/general';

const DB_API = 'https://api.bloop.ai';
let http: AxiosInstance;

export const initApi = (serverUrl = '') => {
  if (!http) {
    http = axios.create({
      baseURL: serverUrl,
    });
  }
};

export const search = (
  q: string,
  page: number = 0,
  page_size: number = 5,
  global_regex: boolean = false,
): Promise<SearchResponse> => {
  return http
    .get('/q', {
      params: {
        q: `${q} global_regex:${global_regex}`,
        page_size,
        page,
        calculate_totals: page === 0,
      },
    })
    .then((r) => r.data);
};

export const getFileLines = (
  repo_ref: string,
  path: string,
  line_start: number,
  line_end: number,
): Promise<FileResponse> => {
  return http
    .get(`/file`, {
      params: {
        repo_ref,
        path,
        line_start,
        line_end,
      },
    })
    .then((r) => r.data);
};

export const nlSearch = (
  q: string,
  user_id: string,
): Promise<NLSearchResponse> => {
  return http
    .get('/answer', {
      params: {
        q,
        user_id,
      },
    })
    .then((r) => r.data);
};

export const getHoverables = async (
  path: string,
  repoId: string,
): Promise<HoverablesResponse> => {
  try {
    const { data } = await http.get('/hoverable', {
      params: { relative_path: path, repo_ref: repoId },
    });
    return data;
  } catch (e) {
    return { ranges: [] };
  }
};

export const getTokenInfo = async (
  path: string,
  repoRef: string,
  start: number,
  end: number,
): Promise<TokenInfoResponse> => {
  return http
    .get('/token-info', {
      params: {
        relative_path: path,
        repo_ref: repoRef,
        start,
        end,
      },
    })
    .then((r) => r.data);
};

export const getAutocomplete = async (
  q: string,
): Promise<SuggestionsResponse> => {
  return http.get(`/autocomplete?q=${q}`).then((r) => r.data);
};

export const gitHubDeviceLogin = () =>
  http.get('/remotes/github/login').then((r) => r.data);

export const gitHubLogout = () =>
  http.get('/remotes/github/logout').then((r) => r.data);

export const gitHubStatus = () =>
  http.get('/remotes/github/status').then((r) => r.data);

export const getRepos = (): Promise<{ list: RepoType[] }> =>
  http.get('/repos').then((r) => r.data);

const localScanCache: Record<string, any> = {};
export const scanLocalRepos = (path: string) => {
  if (localScanCache[path]) {
    return Promise.resolve(localScanCache[path]);
  }
  return http.get(`/repos/scan`, { params: { path } }).then((r) => {
    localScanCache[path] = r.data;
    setTimeout(() => {
      delete localScanCache[path];
    }, 1000 * 60 * 10); // 10 minutes
    return r.data;
  });
};

export const deleteRepo = (repoRef: string) =>
  http.delete(`/repos/indexed/${repoRef}`).then((r) => r.data);

export const syncRepo = (repoRef: string) =>
  http.get(`/repos/sync/${repoRef}`).then((r) => r.data);

export const saveUserData = (userData: {
  email: string;
  first_name: string;
  last_name: string;
  unique_id: string;
}) => axios.post(`${DB_API}/users`, userData).then((r) => r.data);

export const saveBugReport = (report: {
  email: string;
  name: string;
  text: string;
  unique_id: string;
}) => axios.post(`${DB_API}/bug_reports`, report).then((r) => r.data);

export const saveCrashReport = (report: {
  text: string;
  unique_id: string;
  info: string;
  metadata: string;
}) => axios.post(`${DB_API}/crash_reports`, report).then((r) => r.data);

export const saveUpvote = (upvote: {
  unique_id: string;
  snippet_id: string;
  query: string;
  text: string;
  is_upvote: boolean;
}) => axios.post(`${DB_API}/upvotes`, upvote).then((r) => r.data);

export const getUpvote = (params: {
  unique_id: string;
  snippet_id: string;
  query: string;
}) => axios.get(`${DB_API}/upvote`, { params }).then((r) => r.data);

export const getDiscordLink = () =>
  axios.get(`${DB_API}/discord-url`).then((r) => r.data);

export const githubWebLogin = () =>
  http.get('/auth/login/start').then((r) => r.data);

export const getConfig = () => http.get('/config').then((r) => r.data);

export const getAllConversations = (
  repo_ref: string,
): Promise<AllConversationsResponse> =>
  http
    .get('/answer/conversations', { params: { repo_ref } })
    .then((r) => r.data);

export const getConversation = (
  thread_id: string,
): Promise<ConversationType[]> =>
  Promise.resolve([
    {
      finished: true,
      conclusion:
        'The man page for HTTPie covers its usage, positional arguments, predefined content types, content processing options, output processing options, output options, sessions, authentication, network options, and SSL',
      search_steps: [
        {
          type: 'QUERY',
          content: 'summarize the man page for me',
        },
        {
          type: 'PROC',
          content: 'extras/man/https.1',
        },
        {
          type: 'PROMPT',
          content: 'awaiting prompt',
        },
      ],
      results: [
        {
          Cite: {
            path: 'extras/man/https.1',
            comment:
              'HTTPie is a modern, user-friendly command-line HTTP client',
            start_line: 9,
            end_line: 9,
          },
        },
        {
          Cite: {
            path: 'extras/man/https.1',
            comment: 'Synopsis: https [METHOD] URL [REQUEST_ITEM ...]',
            start_line: 6,
            end_line: 6,
          },
        },
        {
          Cite: {
            path: 'extras/man/https.1',
            comment: 'Positional arguments: METHOD, URL, REQUEST_ITEM',
            start_line: 15,
            end_line: 77,
          },
        },
        {
          Cite: {
            path: 'extras/man/https.1',
            comment: 'Predefined content types: --json, --form, --multipart',
            start_line: 85,
            end_line: 108,
          },
        },
        {
          Cite: {
            path: 'extras/man/https.1',
            comment: 'Content processing options: --compress',
            start_line: 138,
            end_line: 149,
          },
        },
        {
          Cite: {
            path: 'extras/man/https.1',
            comment:
              'Output processing options: --pretty, --style, --unsorted, --sorted, --response-charset, --response-mime, --format-options',
            start_line: 151,
            end_line: 239,
          },
        },
        {
          Cite: {
            path: 'extras/man/https.1',
            comment:
              'Output options: --print, --headers, --meta, --body, --verbose, --all, --stream, --output, --download, --continue, --quiet',
            start_line: 241,
            end_line: 354,
          },
        },
        {
          Cite: {
            path: 'extras/man/https.1',
            comment: 'Sessions: --session, --session-read-only',
            start_line: 356,
            end_line: 380,
          },
        },
        {
          Cite: {
            path: 'extras/man/https.1',
            comment: 'Authentication: --auth, --auth-type, --ignore-netrc',
            start_line: 382,
            end_line: 412,
          },
        },
        {
          Cite: {
            path: 'extras/man/https.1',
            comment:
              'Network options: --offline, --proxy, --follow, --max-redirects, --max-headers, --timeout, --check-status, --path-as-is, --chunked',
            start_line: 414,
            end_line: 487,
          },
        },
        {
          Cite: {
            path: 'extras/man/https.1',
            comment: 'SSL options: --verify, --ssl, --ciphers, --cert',
            start_line: 489,
            end_line: 522,
          },
        },
      ],
    },
  ]);

export const deleteConversation = (
  thread_id: string,
): Promise<ConversationType> =>
  http
    .delete(`/answer/conversations`, { params: { thread_id } })
    .then((r) => r.data);
