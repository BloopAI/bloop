import React, {
  FormEvent,
  memo,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { DocShortType } from '../../../types/api';
import {
  getIndexedDocs,
  indexDocsUrl,
  verifyDocsUrl,
} from '../../../services/api';
import IndexedDocRow from './IndexedDocRow';

type Props = {};

const SelectDocProvider = ({ isVisible }: Props) => {
  return <div>{}</div>;
};

export default memo(SelectDocProvider);
