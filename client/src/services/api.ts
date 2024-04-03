import axios, { AxiosInstance, GenericAbortSignal } from 'axios';
import {
  AllConversationsResponse,
  CodeStudioType,
  ConversationExchangeType,
  ConversationType,
  Directory,
  DocPageType,
  DocSectionType,
  DocShortType,
  FileResponse,
  GeneratedCodeDiff,
  HistoryConversationTurn,
  HoverablesResponse,
  NLSearchResponse,
  ProjectShortType,
  SearchResponse,
  StudioTemplateType,
  SuggestionsResponse,
  TokenInfoResponse,
  TutorialQuestionType,
} from '../types/api';
import { RepoType } from '../types/general';

export const API_BASE_URL = 'http://localhost:7878/api';
const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

export const search = (
  projectId: string,
  q: string,
  page: number = 0,
  page_size: number = 5,
  global_regex: boolean = false,
): Promise<SearchResponse> => {
  return http
    .get(`/projects/${projectId}/q`, {
      params: {
        q: `${q} global_regex:${global_regex}`,
        page_size,
        page,
        calculate_totals: page === 0,
      },
    })
    .then((r) => r.data);
};

export const searchFiles = (
  q: string,
  repo_ref: string,
  page_size: number = 100,
): Promise<SearchResponse> => {
  return http
    .get('/search/path', {
      params: {
        q,
        repo_ref,
        page_size,
      },
    })
    .then((r) => r.data);
};

export const getFileContent = (
  repo_ref: string,
  path: string,
  branch?: string | null,
): Promise<FileResponse> => {
  return http
    .get(`/file`, {
      params: {
        repo_ref,
        path,
        ...(branch ? { branch } : {}),
      },
    })
    .then((r) => r.data);
};

export const getFolderContent = (
  repo_ref: string,
  path?: string,
  branch?: string | null,
): Promise<Directory> => {
  return http
    .get(`/folder`, {
      params: {
        repo_ref,
        path: path || '',
        ...(branch ? { branch } : {}),
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
  relative_path: string,
  repo_ref: string,
  branch?: string | null,
): Promise<HoverablesResponse> => {
  try {
    const { data } = await http.get('/hoverable', {
      params: {
        relative_path,
        repo_ref,
        ...(branch ? { branch } : {}),
      },
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
  branch?: string,
): Promise<TokenInfoResponse> => {
  return http
    .get('/token-info', {
      params: {
        relative_path: path,
        repo_ref: repoRef,
        start,
        end,
        branch,
      },
    })
    .then((r) => r.data);
};

export const indexRepoBranch = async (repoRef: string, branch: string) => {
  return http.patch(
    '/repos/indexed',
    { branch_filter: { select: [branch] } },
    { params: { repo: repoRef } },
  );
};

export const getAutocomplete = async (
  projectId: string,
  q: string,
): Promise<SuggestionsResponse> => {
  return http
    .get(`/projects/${projectId}/autocomplete?q=${q}`)
    .then((r) => r.data);
};

export const getRepos = (): Promise<{ list: RepoType[] }> =>
  http.get('/repos').then((r) => r.data);
export const getIndexedRepos = (): Promise<{ list: RepoType[] }> =>
  http.get('/repos/indexed').then((r) => r.data);

const localScanCache: Record<string, any> = {};
export const scanLocalRepos = (path: string) => {
  if (localScanCache[path]) {
    return Promise.resolve(localScanCache[path]);
  }
  return http.get(`/repos/scan`, { params: { path } }).then((r) => {
    localScanCache[path] = r.data;
    setTimeout(
      () => {
        delete localScanCache[path];
      },
      1000 * 60 * 10,
    ); // 10 minutes
    return r.data;
  });
};

export const deleteRepo = (repoRef: string) =>
  http
    .delete(`/repos/indexed`, { params: { repo: repoRef } })
    .then((r) => r.data);

export const cancelSync = (repoRef: string) =>
  http.delete(`/repos/sync`, { params: { repo: repoRef } }).then((r) => r.data);

export const syncRepo = (repoRef: string) =>
  http.get(`/repos/sync`, { params: { repo: repoRef } }).then((r) => r.data);

export const getProjectConversations = (
  projectId: string,
): Promise<AllConversationsResponse> =>
  http.get(`/projects/${projectId}/conversations`).then((r) => r.data);

export const getConversation = (
  projectId: string,
  conversationId: string,
): Promise<ConversationType> =>
  http
    .get(`/projects/${projectId}/conversations/${conversationId}`)
    .then((r) => r.data);

export const deleteConversation = (
  projectId: string,
  conversationId: string,
): Promise<void> =>
  http
    .delete(`/projects/${projectId}/conversations/${conversationId}`)
    .then((r) => r.data);

export const upvoteAnswer = (
  projectId: string,
  thread_id: string,
  query_id: string,
  feedback: { type: 'positive' } | { type: 'negative'; feedback: string },
): Promise<ConversationExchangeType> =>
  http
    .post(`/projects/${projectId}/answer/vote`, {
      thread_id,
      query_id,
      feedback,
    })
    .then((r) => r.data);

export const getIndexQueue = () => http('/repos/queue').then((r) => r.data);

export const getCodeStudios = (projectId: string): Promise<CodeStudioType[]> =>
  http(`/projects/${projectId}/studios`).then((r) => r.data);
export const patchCodeStudio = (
  projectId: string,
  id: string,
  data: Partial<CodeStudioType>,
) =>
  http.patch(`/projects/${projectId}/studios/${id}`, data).then((r) => r.data);
export const getCodeStudio = (
  projectId: string,
  id: string,
): Promise<CodeStudioType> =>
  http(`/projects/${projectId}/studios/${id}`).then((r) => r.data);
export const getCodeStudioHistory = (
  projectId: string,
  id: string,
): Promise<HistoryConversationTurn[]> =>
  http(`/projects/${projectId}/studios/${id}/snapshots`).then((r) => r.data);
export const deleteCodeStudio = (
  projectId: string,
  id: string,
): Promise<CodeStudioType> =>
  http.delete(`/projects/${projectId}/studios/${id}`).then((r) => r.data);
export const postCodeStudio = (projectId: string) =>
  http.post(`/projects/${projectId}/studios`, {}).then((r) => r.data);
export const importCodeStudio = (
  projectId: string,
  thread_id: string,
  studio_id?: string,
) =>
  http
    .post(
      `/projects/${projectId}/studios/import`,
      {},
      { params: { thread_id, studio_id } },
    )
    .then((r) => r.data);
export const generateStudioDiff = (
  projectId: string,
  id: string,
  abortSignal?: GenericAbortSignal,
): Promise<GeneratedCodeDiff> =>
  http(`/projects/${projectId}/studios/${id}/diff`, {
    timeout: 10 * 60 * 1000,
    signal: abortSignal,
  }).then((r) => r.data);
export const confirmStudioDiff = (
  projectId: string,
  id: string,
  diff: string,
): Promise<void> =>
  http
    .post(`/projects/${projectId}/studios/${id}/diff/apply`, diff, {
      headers: { 'Content-Type': 'text/plain' },
    })
    .then((r) => r.data);

export const getFileTokenCount = (
  projectId: string,
  path: string,
  repo: string,
  branch?: string,
  ranges?: [number, number][],
): Promise<number> =>
  http
    .post(`/projects/${projectId}/studios/file-token-count`, {
      path,
      repo,
      branch,
      ranges,
    })
    .then((r) => r.data);
export const getDocTokenCount = (
  projectId: string,
  doc_id: string,
  relative_url: string,
  ranges?: string[],
): Promise<number> =>
  http
    .post(`/projects/${projectId}/studios/doc-file-token-count`, {
      doc_id,
      relative_url,
      ranges,
    })
    .then((r) => r.data);

export const getRelatedFiles = (
  relative_path: string,
  repo_ref: string,
  branch?: string,
): Promise<{ files_importing: string[]; files_imported: string[] }> =>
  http(`/related-files`, { params: { relative_path, repo_ref, branch } }).then(
    (r) => r.data,
  );

export const getRelatedFileRanges = (
  repo_ref: string,
  branch: string | undefined,
  source_file_path: string,
  related_file_path: string,
  kind: 'Imported' | 'Importing',
): Promise<{ ranges: { start: { line: number }; end: { line: number } }[] }> =>
  http(`/related-files-with-ranges`, {
    params: { source_file_path, repo_ref, branch, related_file_path, kind },
  }).then((r) => r.data);

export const getTemplates = (): Promise<StudioTemplateType[]> =>
  http('/template').then((r) => r.data);
export const patchTemplate = (
  id: string,
  data: {
    name?: string;
    content?: string;
  },
) => http.patch(`/template/${id}`, data).then((r) => r.data);
export const deleteTemplate = (id: string): Promise<StudioTemplateType> =>
  http.delete(`/template/${id}`).then((r) => r.data);
export const postTemplate = (name: string, content: string) =>
  http.post('/template', { name, content }).then((r) => r.data);

export const forceFileToBeIndexed = (repoRef: string, filePath: string) =>
  http.patch(
    '/repos/indexed',
    { file_filter: { rules: [{ include_file: filePath }] } },
    { params: { repo: repoRef } },
  );

export const getTutorialQuestions = (
  repo_ref: string,
): Promise<{ questions: TutorialQuestionType[] }> =>
  http('/tutorial-questions', { params: { repo_ref } }).then((r) => r.data);

export const getProjectDocs = (projectId: string): Promise<DocShortType[]> =>
  http(`projects/${projectId}/docs`).then((r) => r.data);
export const addDocToProject = (projectId: string, doc_id: string) =>
  http.post(`projects/${projectId}/docs`, { doc_id }).then((r) => r.data);
export const removeDocFromProject = (projectId: string, doc_id: string) =>
  http.delete(`projects/${projectId}/docs/${doc_id}`).then((r) => r.data);
export const indexDocsUrl = (url: string): Promise<string> =>
  http('/docs/enqueue', { params: { url } }).then((r) => r.data);
export const cancelDocIndexing = (docId: string) =>
  http(`/${docId}/cancel`).then((r) => r.data);
export const resyncDoc = (docId: string) =>
  http(`/${docId}/resync`).then((r) => r.data);
export const verifyDocsUrl = (url: string) =>
  http('/docs/verify', { params: { url } }).then((r) => r.data);
export const getIndexedDocs = (): Promise<DocShortType[]> =>
  http('/docs').then((r) => r.data);
export const getDocById = (id: string): Promise<DocShortType> =>
  http(`/docs/${id}`).then((r) => r.data);
export const getIndexedPages = (id: number | string): Promise<DocPageType[]> =>
  http(`/docs/${id}/list`, { params: { limit: 100 } }).then((r) => r.data);
export const deleteDocProvider = (
  id: number | string,
): Promise<DocPageType[]> => http.delete(`/docs/${id}`).then((r) => r.data);
export const searchDocSections = (
  id: string,
  q: string,
): Promise<DocSectionType[]> =>
  http(`/docs/${id}/search`, { params: { q, limit: 20 } }).then((r) => r.data);
export const getDocSections = (
  id: number | string,
  url: string,
): Promise<DocSectionType[]> =>
  http(`/docs/${id}/fetch`, {
    params: { relative_url: url },
  }).then((r) => r.data);

export const getAllProjects = (): Promise<ProjectShortType[]> =>
  http('/projects').then((r) => r.data);
export const getProject = (id: string): Promise<ProjectShortType> =>
  http(`/projects/${id}`).then((r) => r.data);
export const createProject = (name: string): Promise<string> =>
  http.post(`/projects`, { name }).then((r) => r.data);
export const updateProject = (id: string, data: Partial<ProjectShortType>) =>
  http.put(`/projects/${id}`, data).then((r) => r.data);
export const deleteProject = (id: string) =>
  http.delete(`/projects/${id}`).then((r) => r.data);
export const getProjectRepos = (
  id: string,
): Promise<{ repo: RepoType; branch: string }[]> =>
  http(`/projects/${id}/repos`).then((r) => r.data);
export const addRepoToProject = (
  id: string,
  repoRef: string,
  branch?: string,
) =>
  http
    .post(`/projects/${id}/repos`, { ref: repoRef, branch })
    .then((r) => r.data);
export const removeRepoFromProject = (id: string, repoRef: string) =>
  http
    .delete(`/projects/${id}/repos/`, { params: { ref: repoRef } })
    .then((r) => r.data);
export const changeRepoBranch = (
  id: string,
  repoRef: string,
  branch?: string | null,
) =>
  http
    .put(`/projects/${id}/repos/`, { ref: repoRef, branch: branch || '' })
    .then((r) => r.data);
