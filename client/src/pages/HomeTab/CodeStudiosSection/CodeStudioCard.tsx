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
import FileIcon from '../../../components/FileIcon';
import { PersonalQuotaContext } from '../../../context/personalQuotaContext';
import Tooltip from '../../../components/Tooltip';

type Props = {
  modified_at: string;
  name: string;
  id: string;
  refetchStudios: () => void;
  most_common_ext: string;
  handleRename: () => void;
};

const CodeStudioCard = ({
  name,
  modified_at,
  id,
  refetchStudios,
  most_common_ext,
  handleRename,
}: Props) => {
  const { t } = useTranslation();
  const { locale } = useContext(LocaleContext);
  const { handleAddStudioTab, handleRemoveTab } = useContext(TabsContext);
  const { refetchQuota } = useContext(PersonalQuotaContext.Handlers);

  const handleClick = useCallback(() => {
    handleAddStudioTab(name, id);
    refetchQuota();
  }, [name, handleAddStudioTab, refetchQuota]);

  const dropdownItems = useMemo(() => {
    const items: ContextMenuItem[] = [
      {
        type: MenuItemType.DEFAULT,
        text: t('Rename'),
        icon: <PenUnderline />,
        onClick: () => handleRename(),
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
  }, [handleRename, refetchStudios, handleRemoveTab]);

  return (
    <a
      href="#"
      className={`bg-bg-base hover:bg-bg-base-hover focus:bg-bg-base-hover border border-bg-border rounded-md p-4 w-67 h-36 group
       flex-shrink-0 flex flex-col justify-between cursor-pointer transition-all duration-150`}
      onClick={handleClick}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-4">
          <span
            className={`h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-md ${
              most_common_ext ? 'bg-bg-shade' : 'bg-studio'
            } text-label-control file-icon-lg`}
          >
            {most_common_ext ? (
              <FileIcon filename={`index.${most_common_ext}`} noMargin />
            ) : (
              <CodeStudioIcon raw sizeClassName="h-4 w-4" />
            )}
          </span>
          <div className="min-h-[2.75rem] flex items-center">
            {name.length > 43 ? (
              <Tooltip text={name} placement={'top'}>
                <p className="break-word text-label-title -mt-1">
                  {name.slice(0, 41)}...
                </p>
              </Tooltip>
            ) : (
              <p className="break-word text-label-title -mt-1">{name}</p>
            )}
          </div>
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
