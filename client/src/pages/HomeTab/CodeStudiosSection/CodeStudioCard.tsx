import { memo, useCallback, useContext, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { getDateFnsLocale } from '../../../utils';
import Dropdown from '../../../components/Dropdown/WithIcon';
import {
  Calendar,
  CodeStudioIcon,
  MoreVertical,
  PenUnderline,
  TrashCanFilled,
} from '../../../icons';
import { MenuItemType } from '../../../types/general';
import { LocaleContext } from '../../../context/localeContext';
import { TabsContext } from '../../../context/tabsContext';
import { ContextMenuItem } from '../../../components/ContextMenu';
import { deleteCodeStudio } from '../../../services/api';

type Props = {
  modified_at: string;
  name: string;
  id: string;
  refetchStudios: () => void;
};

const CodeStudioCard = ({ name, modified_at, id, refetchStudios }: Props) => {
  const { t } = useTranslation();
  const { locale } = useContext(LocaleContext);
  const { handleAddStudioTab, handleRemoveTab } = useContext(TabsContext);

  const handleClick = useCallback(() => {
    handleAddStudioTab(name, id);
  }, [name, handleAddStudioTab]);

  const dropdownItems = useMemo(() => {
    const items: ContextMenuItem[] = [
      {
        type: MenuItemType.DEFAULT,
        text: t('Rename'),
        icon: <PenUnderline />,
      },
      {
        type: MenuItemType.DEFAULT,
        text: t('Delete'),
        icon: <TrashCanFilled />,
        onClick: () => {
          deleteCodeStudio(id).then(() => {
            refetchStudios();
            handleRemoveTab(id);
          });
        },
      },
    ];
    return items;
  }, []);

  return (
    <a
      href="#"
      className={`bg-bg-base hover:bg-bg-base-hover focus:bg-bg-base-hover border border-bg-border rounded-md p-4 w-67 h-36 group
       flex-shrink-0 flex flex-col justify-between cursor-pointer transition-all duration-150`}
      onClick={handleClick}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-4">
          <span className="h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-md bg-studio text-label-control">
            <CodeStudioIcon raw sizeClassName="h-4 w-4" />
          </span>
          <p className="break-all text-label-title pt-0.5">{name}</p>
        </div>
        <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all duration-150">
          <Dropdown
            icon={<MoreVertical />}
            noChevron
            btnSize="small"
            size="small"
            btnOnlyIcon
            btnVariant="secondary"
            dropdownPlacement="bottom-end"
            items={dropdownItems}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 caption text-label-base">
        <Calendar raw sizeClassName="w-4 h-4" />
        <p className="select-none">
          <Trans>Last modified</Trans>{' '}
          {formatDistanceToNow(new Date(modified_at + '.000Z'), {
            addSuffix: true,
            ...(getDateFnsLocale(locale) || {}),
          })}
        </p>
      </div>
    </a>
  );
};

export default memo(CodeStudioCard);
