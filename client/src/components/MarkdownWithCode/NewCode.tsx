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
            ? 'my-4 bg-bg-sub text-xs'
            : 'my-4 p-4 bg-bg-shade text-sm'
          : 'bg-chat-bg-sub text-sm'
      } border border-bg-border rounded-md relative group-code`}
    >
      {isCodeStudio && (
        <div className="bg-bg-shade border-b border-bg-border p-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileIcon
              filename={getFileExtensionForLang(language, true)}
              noMargin
            />
            {getPrettyLangName(language)}
          </div>
          <CopyButton isInHeader={isCodeStudio} code={code} />
        </div>
      )}
      <div className={`overflow-auto ${isCodeStudio ? 'p-2' : ''}`}>
        <Code showLines={false} code={code} language={language} canWrap />
      </div>
      {!isCodeStudio && <CopyButton isInHeader={isCodeStudio} code={code} />}
    </div>
  );
};

export default NewCode;
