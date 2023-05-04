import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDownFilled, ChevronUpFilled } from '../../icons';
import { ACCORDION_CHILDREN_ANIMATION } from '../../consts/animations';

type Props = {
  title: string | React.ReactNode;
  icon: React.ReactElement;
  headerItems?: React.ReactNode;
  children: React.ReactNode;
};

const zeroHeight = { height: 0 };
const autoHeight = { height: 'auto' };

const Accordion = ({ title, icon, children, headerItems }: Props) => {
  const [expanded, setExpanded] = useState(true);
  return (
    <div
      className={`rounded border hover:border-bg-border ${
        expanded ? 'border-bg-border' : 'border-transparent'
      } overflow-hidden`}
    >
      <span
        className="bg-bg-shade hover:bg-base-hover flex flex-row px-4 py-2 justify-between items-center	select-none gap-2 group cursor-pointer"
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
