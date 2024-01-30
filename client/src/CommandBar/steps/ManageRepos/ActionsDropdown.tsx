import { Dispatch, memo, SetStateAction, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SectionLabel from '../../../components/Dropdown/Section/SectionLabel';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import DropdownSection from '../../../components/Dropdown/Section';
import { CommandBarContext } from '../../../context/commandBarContext';
import { HardDriveIcon, ShapesIcon } from '../../../icons';
import GitHubIcon from '../../../icons/GitHubIcon';
import { Filter, Provider } from './index';

type Props = {
  setRepoType: Dispatch<SetStateAction<Provider>>;
  repoType: Provider;
  setFilter: Dispatch<SetStateAction<Filter>>;
  filter: Filter;
  handleClose: () => void;
};

const ActionsDropDown = ({
  setRepoType,
  repoType,
  setFilter,
  filter,
  handleClose,
}: Props) => {
  const { t } = useTranslation();
  const { focusedItem } = useContext(CommandBarContext.FooterValues);

  const providerIconMap = useMemo(
    () => ({
      [Provider.All]: ShapesIcon,
      [Provider.GitHub]: GitHubIcon,
      [Provider.Local]: HardDriveIcon,
    }),
    [],
  );

  const providerOptions = useMemo(
    () => [Provider.All, Provider.GitHub, Provider.Local],
    [],
  );
  const filterOptions = useMemo(
    () => [Filter.All, Filter.Indexed, Filter.Indexing, Filter.InThisProject],
    [],
  );

  const focusedDropdownItems = useMemo(() => {
    return (
      (focusedItem &&
        'focusedItemProps' in focusedItem &&
        focusedItem.focusedItemProps?.dropdownItems) ||
      []
    );
  }, [focusedItem]);

  return (
    <div>
      {!!focusedDropdownItems.length &&
        focusedDropdownItems.map(
          (section: { items: Record<string, any>[]; key: string }) => (
            <DropdownSection borderBottom key={section.key}>
              {section.items.map((item: Record<string, any>) => (
                <SectionItem
                  color="base"
                  shortcut={item.shortcut}
                  key={item.key}
                  onClick={() => {
                    item.onClick();
                    handleClose();
                  }}
                  label={item.label}
                  icon={item.icon}
                  index={item.key}
                />
              ))}
            </DropdownSection>
          ),
        )}
      <DropdownSection>
        <SectionLabel text={t('Filter repositories by')} />
        {providerOptions.map((type, i) => {
          const Icon = providerIconMap[type];
          return (
            <SectionItem
              color="base"
              shortcut={['shift', (i + 1).toString()]}
              key={type}
              index={`provider-${type}`}
              isSelected={repoType === type}
              onClick={() => {
                setRepoType(type);
                handleClose();
              }}
              label={t(type)}
              icon={<Icon sizeClassName="w-4 h-4" />}
            />
          );
        })}
      </DropdownSection>
      <DropdownSection>
        <SectionLabel text={t('Display')} />
        {filterOptions.map((type) => (
          <SectionItem
            color="base"
            key={type}
            isSelected={filter === type}
            index={`display-${type}`}
            onClick={() => {
              setFilter(type);
              handleClose();
            }}
            label={t(type)}
          />
        ))}
      </DropdownSection>
    </div>
  );
};

export default memo(ActionsDropDown);
