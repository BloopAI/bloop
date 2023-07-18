import {
  ChangeEvent,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trans, useTranslation } from 'react-i18next';
import TextInput from '../TextInput';
import Checkbox from '../Checkbox';
import { FILTER_SECTION_ANIMATION } from '../../consts/animations';
import FilterItem from './FilterItem';
import FilterTitle from './FilterTitle';

type Props = {
  items: {
    label: string;
    description: string;
    checked: boolean;
    icon?: ReactElement;
  }[];
  type: 'checkbox' | 'button';
  onChange: (i: number, c: boolean) => void;
  name: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  onSelectAll: (b: boolean) => void;
  singleSelect?: boolean;
};
const zeroHeight = { height: 0 };
const autoHeight = { height: 'auto' };

const FiltersSection = ({
  items,
  type,
  onChange,
  name,
  title,
  open,
  onToggle,
  onSelectAll,
  singleSelect,
}: Props) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const [filteredItems, setFilteredItems] = useState(items);

  useEffect(() => {
    setFilteredItems(items.filter((i) => i.label.includes(filter)));
  }, [items, filter]);

  const handleFilter = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value);
  }, []);

  const allSelected = useMemo(
    () => filteredItems.every((i) => i.checked),
    [filteredItems],
  );

  const someSelected = useMemo(
    () =>
      filteredItems.some((i) => i.checked) &&
      filteredItems.some((i) => !i.checked),
    [filteredItems],
  );

  return (
    <div className="text-label-title w-full border-b border-bg-border">
      <FilterTitle
        label={title}
        numberSelected={items.filter((i) => i.checked).length}
        isOpen={open}
        handleToggle={onToggle}
      />
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={zeroHeight}
            exit={zeroHeight}
            animate={autoHeight}
            transition={FILTER_SECTION_ANIMATION}
            className="overflow-hidden"
          >
            <div className="pb-8 pt-1 px-8 flex flex-col gap-3">
              <TextInput
                value={filter}
                onChange={handleFilter}
                name={name + '-filter'}
                variant="outlined"
                placeholder={t(`Filter ${name}...`)}
              />
              {filteredItems.length ? (
                <>
                  {!singleSelect ? (
                    <Checkbox
                      checked={allSelected}
                      intermediary={someSelected}
                      label={
                        <span
                          className={`${
                            allSelected ? 'body-s' : 'caption'
                          } whitespace-nowrap overflow-hidden`}
                        >
                          <Trans>
                            {allSelected ? 'Deselect all' : 'Select all'}
                          </Trans>
                        </span>
                      }
                      onChange={onSelectAll}
                    />
                  ) : (
                    ''
                  )}
                  {filteredItems.map((filter, i) => (
                    <FilterItem
                      key={filter.label}
                      label={filter.label}
                      description={filter.description}
                      selected={filter.checked}
                      icon={filter.icon}
                      onSelect={(checked) => onChange(i, checked)}
                      checkbox={type === 'checkbox'}
                    />
                  ))}
                </>
              ) : (
                <div className="text-center">
                  <p className="body-s text-label-title pb-2">
                    <Trans>No results...</Trans>
                  </p>
                  <p className="caption text-label-muted">
                    <Trans>
                      Nothing matched your search. Try a different combination!
                    </Trans>
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FiltersSection;
