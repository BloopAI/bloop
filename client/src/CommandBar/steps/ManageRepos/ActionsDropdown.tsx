import {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import SectionLabel from '../../../components/Dropdown/Section/SectionLabel';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import DropdownSection from '../../../components/Dropdown/Section';
import { CommandBarContext } from '../../../context/commandBarContext';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
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
  const [focusedIndex, setFocusedIndex] = useState(0);

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

  const focusedDropdownItemsLength = useMemo(() => {
    return focusedDropdownItems.reduce(
      (prev: number, curr: { items: Record<string, any>[]; key: string }) =>
        prev + curr.items.length,
      0,
    );
  }, [focusedDropdownItems]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) =>
          prev <
          providerOptions.length +
            filterOptions.length +
            focusedDropdownItemsLength -
            1
            ? prev + 1
            : 0,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) =>
          prev > 0
            ? prev - 1
            : providerOptions.length +
              filterOptions.length +
              focusedDropdownItemsLength -
              1,
        );
      } else if (e.key === 'Enter') {
        if (focusedIndex < focusedDropdownItemsLength) {
          let currentIndex = 0;

          for (let i = 0; i < focusedDropdownItems.length; i++) {
            for (let j = 0; j < focusedDropdownItems[i].items.length; j++) {
              if (currentIndex === focusedIndex) {
                handleClose();
                return focusedDropdownItems[i].items[j].onClick();
              }
              currentIndex++;
            }
          }
        } else if (
          focusedIndex <
          focusedDropdownItemsLength + providerOptions.length
        ) {
          setRepoType(
            providerOptions[focusedIndex - focusedDropdownItemsLength],
          );
        } else {
          setFilter(
            filterOptions[
              focusedIndex - focusedDropdownItemsLength - providerOptions.length
            ],
          );
        }
      }
    },
    [focusedIndex, focusedDropdownItems, focusedDropdownItemsLength],
  );
  useKeyboardNavigation(handleKeyEvent);

  return (
    <div>
      {!!focusedDropdownItems.length &&
        focusedDropdownItems.map(
          (section: {
            items: Record<string, any>[];
            key: string;
            itemsOffset: number;
          }) => (
            <DropdownSection borderBottom key={section.key}>
              {section.items.map((item: Record<string, any>, i: number) => (
                <SectionItem
                  color="base"
                  shortcut={item.shortcut}
                  key={item.key}
                  isFocused={focusedIndex === i + section.itemsOffset}
                  onClick={() => {
                    item.onClick();
                    handleClose();
                  }}
                  label={item.label}
                  icon={item.icon}
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
              isSelected={repoType === type}
              isFocused={focusedIndex === i + focusedDropdownItemsLength}
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
        {filterOptions.map((type, i) => (
          <SectionItem
            color="base"
            key={type}
            isSelected={filter === type}
            isFocused={
              focusedIndex ===
              i + focusedDropdownItemsLength + providerOptions.length
            }
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
