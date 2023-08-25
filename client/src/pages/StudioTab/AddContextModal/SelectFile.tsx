import { memo, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { RepoType } from '../../../types/general';
import KeyboardChip from '../KeyboardChip';
import { searchFiles } from '../../../services/api';
import FileIcon from '../../../components/FileIcon';

type Props = {
  search: string;
  branch: string;
  onSubmit: (branch: string) => void;
  repo: RepoType;
};

const SelectBranch = ({ search, onSubmit, repo, branch }: Props) => {
  useTranslation();
  const [filesToShow, setFilesToShow] = useState<string[]>([]);

  useEffect(() => {
    searchFiles(`${search || '.'}`, repo.ref).then((resp) => {
      setFilesToShow(
        resp.data
          .map((r) =>
            r.kind === 'file_result' ? r.data.relative_path.text : null,
          )
          .filter((f): f is string => !!f),
      );
    });
  }, [search, branch, repo.name]);

  return (
    <>
      {filesToShow.map((b) => (
        <button
          type="button"
          onClick={() => onSubmit(b)}
          key={b}
          className="flex h-9 px-3 gap-3 items-center justify-between group rounded-6 bg-bg-shade hover:bg-bg-base-hover focus:bg-bg-base-hover focus:outline-0 focus:outline-none w-full cursor-pointer body-s ellipsis flex-shrink-0"
        >
          <div className="body-s text-label-base group-hover:text-label-title group-focus:text-label-title ellipsis flex gap-2 items-center">
            <FileIcon filename={b} />
            {b}
          </div>
          <div className="opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all flex gap-1.5 items-center caption text-label-base">
            <Trans>Select</Trans>
            <KeyboardChip type="entr" variant="tertiary" />
          </div>
        </button>
      ))}
    </>
  );
};

export default memo(SelectBranch);
