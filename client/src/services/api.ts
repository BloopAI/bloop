import axios from 'axios';
import {
  HoverablesRespone,
  NLSearchResponse,
  SearchResponse,
  SuggestionsResponse,
  TokenInfoResponse,
} from '../types/api';
import { RepoType } from '../types/general';

const API = 'http://127.0.0.1:7878/api';
const DB_API = 'https://api.bloop.ai';
const http = axios.create({
  baseURL: API,
});

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

const nlSearchResultsCache = new Map();

export const nlSearch = (
  q: string,
  user_id: string,
  search_hash?: string,
): Promise<NLSearchResponse> => {
  if (search_hash && nlSearchResultsCache.has(search_hash)) {
    return Promise.resolve(nlSearchResultsCache.get(search_hash));
  }
  return http
    .get('/answer', {
      params: {
        q,
        user_id,
      },
    })
    .then((r) => {
      if (search_hash) {
        if (nlSearchResultsCache.size === 3) {
          nlSearchResultsCache.delete(nlSearchResultsCache.keys().next().value);
        }
        nlSearchResultsCache.set(search_hash, r.data);
      }
      return r.data;
    });
};

export const getHoverables = async (
  path: string,
  repoId: string,
): Promise<HoverablesRespone> => {
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

export const gitHubLogin = () =>
  http.get('/remotes/github/login').then((r) => r.data);

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
