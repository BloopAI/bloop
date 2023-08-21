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
} from '../../../icons';
import { MenuItemType } from '../../../types/general';
import { LocaleContext } from '../../../context/localeContext';
import { TabsContext } from '../../../context/tabsContext';

type Props = {
  last_modified: string;
  name: string;
};

const CodeStudioCard = ({ name, last_modified }: Props) => {
  const { t } = useTranslation();
  const { locale } = useContext(LocaleContext);
  const { handleAddStudioTab } = useContext(TabsContext);

  const handleClick = useCallback(() => {
    handleAddStudioTab(name);
  }, [name]);

  const dropdownItems = useMemo(() => {
    const items = [
      {
        type: MenuItemType.DEFAULT,
        text: t('Rename'),
        icon: <PenUnderline />,
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
          <span className="h-11 w-11 flex items-center justify-center rounded-md bg-[linear-gradient(135deg,#C7363E_0%,#C7369E_100%)]">
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
          {formatDistanceToNow(new Date(last_modified), {
            addSuffix: true,
            ...(getDateFnsLocale(locale) || {}),
          })}
        </p>
      </div>
    </a>
  );
};

export default memo(CodeStudioCard);
