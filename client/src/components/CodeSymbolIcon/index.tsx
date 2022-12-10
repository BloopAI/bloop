import React, { Suspense } from 'react';
import {
  BaseSymbolType,
  ExtendedSymbolType,
  SymbolType,
} from '../../types/results';
import Text from '../../icons/CodeSymbols/Text';

const ExtendedTypeMapping: Record<ExtendedSymbolType, BaseSymbolType> = {
  function: 'method',
  constructor: 'method',
  generator: 'method',
  func: 'method',
  value: 'enum',
  enumerator: 'enum',
  parameter: 'field',
  const: 'constant',
  var: 'variable',
  type: 'typeParameter',
  union: 'module',
  typedef: 'typeParameter',
  alias: 'text',
  label: 'text',
  member: 'enum',
};

type Props = {
  type: SymbolType;
  sizeClassName?: string;
};

const SymbolIcon: React.FC<Props> = ({ type, sizeClassName }: Props) => {
  const getIconFilename = (symbolType: SymbolType) => {
    const name: string =
      ExtendedTypeMapping[symbolType as ExtendedSymbolType] || symbolType;

    return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  };

  const IconComponent = React.lazy(() => {
    return new Promise((resolve) => {
      import(`../../icons/CodeSymbols/${getIconFilename(type)}.tsx`)
        .then((icon) => {
          resolve(icon);
        })
        .catch(() => {
          import(`../../icons/CodeSymbols/Text`).then((icon) => {
            // @ts-ignore
            return resolve(icon);
          });
        });
    });
  });

  return (
    <span
      className={`${sizeClassName || 'w-4 h-4'} flex flex-shrink-0 flex-grow-0`}
    >
      <Suspense fallback={<Text />}>
        <IconComponent />
      </Suspense>
    </span>
  );
};
export default SymbolIcon;
