import FileIcon from '../../../../../../components/FileIcon';
import { getFileExtensionForLang } from '../../../../../../utils';

type Props = {
  lang: string;
};

const LangChip = ({ lang }: Props) => {
  return (
    <span
      className={`inline-flex items-center bg-bg-base rounded-4 overflow-hidden 
                text-label-base border border-bg-border align-middle`}
    >
      <span className="flex gap-1 px-1 py-0.5 items-center code-s">
        <FileIcon filename={getFileExtensionForLang(lang, true)} />
        <span className="">{lang}</span>
      </span>
    </span>
  );
};

export default LangChip;
