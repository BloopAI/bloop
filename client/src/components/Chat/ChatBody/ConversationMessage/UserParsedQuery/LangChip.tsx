import FileIcon from '../../../../FileIcon';
import { getFileExtensionForLang } from '../../../../../utils';

type Props = {
  lang: string;
};

const LangChip = ({ lang }: Props) => {
  return (
    <span
      className={`inline-flex items-center bg-chat-bg-base rounded-4 overflow-hidden 
                text-label-title align-middle h-6`}
    >
      <span className="flex gap-1 px-1 py-0.5 items-center code-s">
        <FileIcon filename={getFileExtensionForLang(lang, true)} />
        <span className="">{lang}</span>
      </span>
    </span>
  );
};

export default LangChip;
