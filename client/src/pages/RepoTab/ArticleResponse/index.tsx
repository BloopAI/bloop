import { useContext } from 'react';
import { FileModalContext } from '../../../context/fileModalContext';
import { UIContext } from '../../../context/uiContext';
import MarkdownWithCode from '../../../components/MarkdownWithCode';
import Button from '../../../components/Button';
import { CopyMD } from '../../../icons';
import { copyToClipboard } from '../../../utils';
import useConversation from '../../../hooks/useConversation';

type Props = {
  recordId: number;
  threadId: string;
};

const ArticleResponse = ({ recordId, threadId }: Props) => {
  const { openFileModal } = useContext(FileModalContext);
  const { tab } = useContext(UIContext.Tab);
  const { data } = useConversation(threadId, recordId);

  return (
    <div className="overflow-auto p-8 w-screen">
      <div className="flex-1 mx-auto max-w-3xl box-content article-response body-m text-label-base pb-60 break-word relative group-custom">
        <MarkdownWithCode
          openFileModal={openFileModal}
          repoName={tab.repoName}
          markdown={
            data?.isLoading
              ? data?.results?.replace(/\[\`[^`]*$|\[\`[^`]+\`\]\([^)]*$/, '')
              : data?.results
          }
          recordId={recordId}
          threadId={threadId}
        />
        <Button
          variant="secondary"
          size="small"
          onClick={() => copyToClipboard(data?.results)}
          className="absolute top-0 right-0 opacity-0 group-custom-hover:opacity-100 transition-opacity"
        >
          <CopyMD /> Copy
        </Button>
      </div>
    </div>
  );
};

export default ArticleResponse;
