import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDownFilled, ChevronUpFilled } from '../../icons';
import { ACCORDION_CHILDREN_ANIMATION } from '../../consts/animations';
import Button from '../Button';

type Props = {
  title: string | React.ReactNode;
  icon: React.ReactElement;
  headerItems?: React.ReactNode;
  children: React.ReactNode;
  shownItems?: React.ReactNode;
  defaultExpanded?: boolean;
};

const zeroHeight = { height: 0 };
const autoHeight = { height: 'auto' };

const Accordion = ({
  title,
  icon,
  children,
  headerItems,
  shownItems,
  defaultExpanded = true,
}: Props) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);
  return (
    <div
      className={`rounded border hover:border-bg-border ${
        expanded || shownItems ? 'border-bg-border' : 'border-transparent'
      } overflow-hidden relative`}
    >
      <span
        className={`bg-bg-shade hover:bg-base-hover flex flex-row px-4 h-13 justify-between items-center
         gap-2 group cursor-pointer`}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex flex-row items-center gap-2 flex-1 overflow-hidden">
          {icon}
          {title}
        </span>
        <span className="flex flex-row items-center gap-4">
          {headerItems}
          <span>
            <span
              className={`w-2 h-2 block text-label-muted group-hover:text-label-title ${
                expanded ? 'text-label-title' : ''
              }`}
            >
              {expanded ? <ChevronUpFilled raw /> : <ChevronDownFilled raw />}
            </span>
          </span>
        </span>
      </span>
      {!!shownItems && (
        <div className="">
          {shownItems}
          <div
            className={`bg-gradient-to-b from-transparent via-bg-sub/90 to-bg-sub ${
              expanded ? 'mt-2' : 'mt-[-55px] pt-6'
            } mb-3 absolute bottom-0 left-0 right-0 flex justify-center align-center`}
          >
            <Button
              variant="secondary"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }}
            >
              Show {expanded ? 'less' : 'more'}
            </Button>
          </div>
        </div>
      )}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={zeroHeight}
            exit={zeroHeight}
            animate={autoHeight}
            transition={ACCORDION_CHILDREN_ANIMATION}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Accordion;
