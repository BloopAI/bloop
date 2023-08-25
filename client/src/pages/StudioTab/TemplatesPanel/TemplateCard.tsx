import React, { memo, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { MoreHorizontal, Pen, Template, TrashCanFilled } from '../../../icons';
import Button from '../../../components/Button';
import { DropdownWithIcon } from '../../../components/Dropdown';
import { MenuItemType } from '../../../types/general';
import { ContextMenuItem } from '../../../components/ContextMenu';

type Props = {
  name: string;
  body: string;
};

const TemplateCard = ({ name, body }: Props) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const dropdownItems = useMemo(() => {
    return [
      {
        type: MenuItemType.DEFAULT,
        text: t('Edit'),
        icon: <Pen raw sizeClassName="w-3.5 h-3.5" />,
        onClick: () => {
          setIsEditing(true);
          setTimeout(() => {
            if (ref.current) {
              ref.current.focus();
              // set caret at the end of textarea
              ref.current.selectionStart = body.length;
              ref.current.selectionEnd = body.length;
            }
          }, 100);
        },
      },
      {
        type: MenuItemType.DEFAULT,
        text: t('Delete'),
        icon: <TrashCanFilled raw sizeClassName="w-3.5 h-3.5" />,
      },
    ] as ContextMenuItem[];
  }, [body]);
  return (
    <div
      className={`flex flex-col gap-3 p-3 rounded-6 border ${
        isEditing
          ? 'border-bg-main shadow-medium bg-bg-base'
          : 'border-bg-border  hover:border-bg-border-hover hover:bg-bg-base'
      } transition-all duration-150 ease-in-out`}
    >
      <div className="flex items-center gap-2">
        <Template />
        <input
          disabled={!isEditing}
          value={name}
          className="body-s-strong text-label-title flex-1 bg-transparent outline-none focus:outline-0 placeholder:text-label-base"
        />
        {isEditing ? (
          <>
            <Button
              key="cancel"
              variant="secondary"
              size="tiny"
              onClick={() => setIsEditing(false)}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              key="submit"
              size="tiny"
              onClick={() => setIsEditing(false)}
            >
              <Trans>Save changes</Trans>
            </Button>
          </>
        ) : (
          <>
            <Button size="tiny" key="use">
              <Trans>Use</Trans>
            </Button>
            <DropdownWithIcon
              items={dropdownItems}
              btnOnlyIcon
              icon={<MoreHorizontal sizeClassName="w-3.5 h-3.5" />}
              noChevron
              btnSize="tiny"
              dropdownBtnClassName="flex-shrink-0"
              appendTo={document.body}
              size="small"
            />
          </>
        )}
      </div>
      <div className="pl-7">
        <textarea
          disabled={!isEditing}
          value={body}
          className={`w-full bg-transparent outline-none focus:outline-0 resize-none body-m placeholder:text-label-base`}
          rows={1}
          autoComplete="off"
          spellCheck="false"
          ref={ref}
        />
      </div>
    </div>
  );
};

export default memo(TemplateCard);
