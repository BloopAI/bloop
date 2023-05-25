import React, { ReactElement } from 'react';

type Props = {
  title: string;
  description: string | ReactElement;
  isCentered?: boolean;
};

const DialogText = ({ title, description, isCentered = true }: Props) => {
  return (
    <div>
      <h4 className="text-center select-none text-label-title">{title}</h4>
      {!!description && (
        <p
          className={`body-s text-label-base mt-3 ${
            isCentered ? 'text-center' : ''
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
};

export default DialogText;
