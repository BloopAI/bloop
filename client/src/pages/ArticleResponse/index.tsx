import {
  AnchorHTMLAttributes,
  DetailedHTMLProps,
  ReactElement,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactMarkdownProps } from 'react-markdown/lib/complex-types';
import { CodeProps } from 'react-markdown/lib/ast-to-react';
import { conversationsCache } from '../../services/cache';
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageServer,
  ChatMessageType,
} from '../../types/general';
import { ChatContext } from '../../context/chatContext';
import { FileModalContext } from '../../context/fileModalContext';
import { UIContext } from '../../context/uiContext';
import { getConversation } from '../../services/api';
import { mapLoadingSteps } from '../../mappers/conversation';
import MarkdownWithCode from '../../components/MarkdownWithCode';
import FileChip from '../../components/Chat/ConversationMessage/FileChip';
import NewCode from '../ConversationResult/NewCode';
import CodeWithBreadcrumbs from './CodeWithBreadcrumbs';

type Props = {
  recordId: number;
  threadId: string;
};

const ArticleResponse = ({ recordId, threadId }: Props) => {
  const { t } = useTranslation();
  const { conversation, setThreadId, setConversation } =
    useContext(ChatContext);
  const { openFileModal } = useContext(FileModalContext);
  const { tab } = useContext(UIContext);
  const data = useMemo(
    () => conversationsCache[threadId]?.[recordId] || conversation[recordId],
    [
      (conversation[recordId] as ChatMessageServer)?.results,
      (conversation[recordId] as ChatMessageServer)?.isLoading,
      recordId,
      threadId,
    ],
  );

  useEffect(() => {
    if (!conversationsCache[threadId]?.[recordId] && !conversation[recordId]) {
      getConversation(threadId).then((resp) => {
        const conv: ChatMessage[] = [];
        resp.forEach((m) => {
          const userQuery = m.search_steps.find((s) => s.type === 'QUERY');
          if (userQuery) {
            conv.push({
              author: ChatMessageAuthor.User,
              text: userQuery.content,
              isFromHistory: true,
            });
          }
          conv.push({
            author: ChatMessageAuthor.Server,
            isLoading: false,
            type: ChatMessageType.Answer,
            loadingSteps: mapLoadingSteps(m.search_steps, t),
            text: m.conclusion,
            results: m.outcome,
            isFromHistory: true,
          });
        });
        conversationsCache[threadId] = conv;
        setThreadId(threadId);
        setConversation(conv);
      });
    }
  }, []);

  const components = useMemo(() => {
    return {
      a(
        props: Omit<
          DetailedHTMLProps<
            AnchorHTMLAttributes<HTMLAnchorElement>,
            HTMLAnchorElement
          >,
          'ref'
        > &
          ReactMarkdownProps,
      ) {
        const [filePath, lines] = props.href?.split('#') || [];
        const [start, end] =
          lines?.split('-').map((l) => Number(l.slice(1))) || [];
        let fileName: string = '';
        if (props.children?.[0]) {
          if (typeof props.children[0] === 'string') {
            fileName = props.children?.[0];
          }
          const child = props.children[0] as ReactElement;
          if (child?.props && typeof child.props.children?.[0] === 'string') {
            fileName = child.props.children?.[0];
          }
        }
        return (
          <FileChip
            fileName={fileName || filePath || ''}
            skipIcon={!!fileName && fileName !== filePath}
            onClick={() =>
              openFileModal(
                filePath,
                start ? `${start - 1}_${(end ?? start) - 1}` : undefined,
              )
            }
          />
        );
      },
      code({ node, inline, className, children, ...props }: CodeProps) {
        const matchLang = /lang:(\w+)/.exec(className || '');
        const matchType = /language-type:(\w+)/.exec(className || '');
        const matchPath = /path:(.+),/.exec(className || '');
        const matchLines = /lines:(.+)/.exec(className || '');
        const code =
          typeof children[0] === 'string' ? children[0].replace(/\n$/, '') : '';
        const lines = matchLines?.[1].split('-').map((l) => Number(l)) || [];
        const colorPreview =
          children[0] &&
          children.length === 1 &&
          typeof children[0] === 'string' &&
          /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(children[0]) ? (
            <span
              className="w-3 h-3 inline-block"
              style={{ backgroundColor: children[0] }}
            />
          ) : null;
        return !inline && matchType?.[1] && typeof children[0] === 'string' ? (
          matchType?.[1] === 'Quoted' ? (
            <CodeWithBreadcrumbs
              code={code}
              language={matchLang?.[1] || ''}
              filePath={matchPath?.[1] || ''}
              onResultClick={openFileModal}
              startLine={lines[0] ? lines[0] - 1 : null}
              repoName={tab.repoName}
            />
          ) : (
            <NewCode code={code} language={matchLang?.[1] || ''} />
          )
        ) : colorPreview ? (
          <span className="inline-flex gap-1.5 items-center">
            {colorPreview}
            <code {...props} className={className}>
              {children}
            </code>
          </span>
        ) : (
          <code {...props} className={className}>
            {children}
          </code>
        );
      },
    };
  }, [tab.repoName, openFileModal]);

  return (
    <div className="overflow-auto p-8 w-screen">
      <div className="flex-1 mx-auto max-w-3xl box-content article-response body-m text-label-base pb-44 break-word">
        <MarkdownWithCode
          openFileModal={openFileModal}
          repoName={tab.repoName}
          markdown={
            data?.isLoading
              ? data?.results?.Article?.replace(
                  /\[\`[^`]*$|\[\`[^`]+\`\]\([^)]*$/,
                  '',
                )
              : data?.results?.Article
          }
        />
      </div>
    </div>
  );
};

export default ArticleResponse;
