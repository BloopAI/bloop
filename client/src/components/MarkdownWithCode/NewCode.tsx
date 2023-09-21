import Code from '../CodeBlock/Code';
import { getFileExtensionForLang, getPrettyLangName } from '../../utils';
import FileIcon from '../FileIcon';
import CopyButton from './CopyButton';

type Props = {
  code: string;
  language: string;
  isSummary?: boolean;
  isCodeStudio?: boolean;
};

const NewCode = ({ code, language, isSummary, isCodeStudio }: Props) => {
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
        <div className="flex items-center gap-2">
          <FileIcon
            filename={getFileExtensionForLang(language, true)}
            noMargin
          />
          {getPrettyLangName(language)}
        </div>
        <CopyButton isInHeader code={code} />
      </div>
      <div className={`overflow-auto p-2`}>
        <Code showLines={false} code={code} language={language} canWrap />
      </div>
    </div>
  );
};

export default NewCode;
