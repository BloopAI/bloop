import Code from '../../../components/CodeBlock/Code';
import { getFileExtensionForLang, getPrettyLangName } from '../../../utils';
import FileIcon from '../../../components/FileIcon';
import BreadcrumbsPath from '../../../components/BreadcrumbsPath';
import CopyButton from './CopyButton';

type Props = {
  code: string;
  language: string;
  filePath: string;
  isSummary?: boolean;
  isCodeStudio?: boolean;
};

const NewCode = ({
  code,
  language,
  isSummary,
  isCodeStudio,
  filePath,
}: Props) => {
  return (
    <div
      className={`${
        !isSummary
          ? isCodeStudio
            ? 'my-4 bg-bg-sub text-xs border-bg-border'
            : 'my-4 bg-chat-bg-base text-sm border-chat-bg-divider'
          : 'bg-chat-bg-sub text-sm'
      } border rounded-md relative group-code`}
    >
      <div
        className={`${
          isCodeStudio
            ? 'bg-bg-shade border-bg-border'
            : 'bg-chat-bg-shade border-chat-bg-divider'
        } border-b rounded-t-md p-2 flex items-center justify-between gap-2`}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <FileIcon
            filename={filePath || getFileExtensionForLang(language, true)}
            noMargin
          />
          {filePath ? (
            <BreadcrumbsPath path={filePath} repo={''} nonInteractive />
          ) : (
            <span className="caption-strong">
              {getPrettyLangName(language) || language}
            </span>
          )}
        </div>
        <CopyButton isInHeader code={code} />
      </div>
      <div className={`overflow-auto ${isCodeStudio ? 'p-2' : 'py-2 code-s'}`}>
        <Code showLines={false} code={code} language={language} canWrap />
      </div>
    </div>
  );
};

export default NewCode;
