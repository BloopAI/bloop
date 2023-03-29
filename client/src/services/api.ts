import axios, { AxiosInstance } from 'axios';
import {
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
export const scanLocalRepos = (path: string) =>
  http.get(`/repos/scan`, { params: { path } }).then((r) => r.data);

export const syncRepos = (repos: string[]) =>
  http
    .put('/repos/indexed', {
      indexed: repos,
    })
    .then((r) => r.data);

export const deleteRepo = (repoRef: string) =>
  http.delete(`/repos/indexed/${repoRef}`).then((r) => r.data);

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
