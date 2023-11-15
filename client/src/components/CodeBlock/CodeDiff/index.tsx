import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import FileIcon from '../../FileIcon';
import { getFileExtensionForLang, getPrettyLangName } from '../../../utils';
import BreadcrumbsPath from '../../BreadcrumbsPath';
import CopyButton from '../../MarkdownWithCode/CopyButton';
import Code from '../Code';
import { DiffChunkType } from '../../../types/general';
import Button from '../../Button';
import { Pen, TrashCanFilled } from '../../../icons';

type Props = DiffChunkType & {
  onClick: (d: DiffChunkType) => void;
  language: string;
  filePath: string;
  onDiffRemoved: (i: number) => void;
  onDiffChanged: (i: number, p: string) => void;
  i: number;
};

const CodeDiff = ({
  hunks,
  language,
  filePath,
  onClick,
  file,
  repo,
  branch,
  raw_patch,
  lang,
  i,
  onDiffChanged,
  onDiffRemoved,
}: Props) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedValue, setEditedValue] = useState(
    raw_patch.split('\n').slice(2, -1).join('\n'),
  );
  const { t } = useTranslation();

  useEffect(() => {
    setEditedValue(raw_patch.split('\n').slice(2, -1).join('\n'));
  }, [raw_patch]);

  const handleClick = useCallback(() => {
    onClick({ hunks, repo, branch, file, lang, raw_patch });
  }, [hunks, repo, branch, file, lang, raw_patch]);

  const onEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditMode(true);
  }, []);

  const onCancelEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditMode(false);
  }, []);

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setEditedValue(e.target.value);
  }, []);

  const onSaveEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDiffChanged(
        i,
        `--- ${filePath}
+++ ${filePath}
${editedValue}
`,
      );
      setIsEditMode(false);
    },
    [i, editedValue, onDiffChanged],
  );

  const onRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDiffRemoved(i);
    },
    [i, onDiffRemoved],
  );

  return (
    <div
      onClick={handleClick}
      className={`my-4 block bg-bg-sub text-xs border-bg-border border rounded-md relative group-code cursor-pointer`}
    >
      <div
        className={`bg-bg-shade border-bg-border border-b rounded-t-md p-2 flex items-center justify-between gap-2`}
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
        <div className="flex items-center gap-2">
          {!repo.startsWith('local//') ? (
            <CopyButton isInHeader code={raw_patch} />
          ) : isEditMode ? (
            <>
              <Button size="tiny" variant="secondary" onClick={onCancelEdit}>
                <Trans>Cancel</Trans>
              </Button>
              <Button size="tiny" onClick={onSaveEdit}>
                <Trans>Save</Trans>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                size="tiny"
                onlyIcon
                title={t('Edit')}
                onClick={onEditClick}
              >
                <Pen
                  raw
                  sizeClassName="w-3.5 h-3.5"
                  className="text-label-muted"
                />
              </Button>
              <Button
                variant="secondary"
                size="tiny"
                onlyIcon
                title={t('Remove')}
                onClick={onRemove}
              >
                <TrashCanFilled
                  raw
                  sizeClassName="w-3.5 h-3.5"
                  className="text-label-muted"
                />
              </Button>
            </>
          )}
        </div>
      </div>
      <div className={`overflow-auto py-2`}>
        {isEditMode ? (
          <textarea
            className={`px-2 w-full bg-transparent outline-none focus:outline-0 resize-none body-s placeholder:text-label-base`}
            value={editedValue}
            onChange={handleChange}
            rows={Math.min(10, raw_patch.split('\n').length)}
          />
        ) : (
          hunks.map((h, index) => (
            <>
              <Code
                key={h.line_start}
                showLines
                code={h.patch.slice(0, -1)}
                language={language}
                isDiff
                lineStart={h.line_start - 1}
              />
              {index !== hunks.length - 1 ? (
                <pre className={`bg-bg-sub my-0 px-2`}>
                  <table>
                    <tbody>
                      <tr className="token-line">
                        <td className="text-label-muted min-w-6 text-right text-l select-none">
                          ..
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </pre>
              ) : null}
            </>
          ))
        )}
      </div>
    </div>
  );
};

export default CodeDiff;
