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
    <div className="rounded border border-gray-700 overflow-hidden">
      <span className="bg-gray-800 flex flex-row px-4 py-2 justify-between items-center	select-none gap-2">
        <span className="flex flex-row items-center gap-2 flex-1 overflow-hidden">
          {icon}
          {title}
        </span>
        <span className="flex flex-row items-center gap-4">
          {headerItems}
          <span
            className="cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            <span className="w-2 h-2 block">
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
