import React, {
  memo,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { StudioContext } from '../studioContext';
import { StudioTemplateType } from '../../types/api';
import { getTemplates } from '../../services/api';

type Props = {};

export const StudioContextProvider = memo(
  ({ children }: PropsWithChildren<Props>) => {
    const [inputValue, setInputValue] = useState('');
    const [templates, setTemplates] = useState<StudioTemplateType[]>([]);

    const refetchTemplates = useCallback(() => {
      getTemplates().then((resp) => setTemplates(resp.reverse()));
    }, []);

    useEffect(() => {
      refetchTemplates();
    }, [refetchTemplates]);

    const inputContextValue = useMemo(
      () => ({
        inputValue,
      }),
      [inputValue],
    );
    const templatesContextValue = useMemo(
      () => ({
        templates,
      }),
      [templates],
    );
    const settersContextValue = useMemo(
      () => ({
        setInputValue,
        setTemplates,
        refetchTemplates,
      }),
      [],
    );

    return (
      <StudioContext.Setters.Provider value={settersContextValue}>
        <StudioContext.Input.Provider value={inputContextValue}>
          <StudioContext.Templates.Provider value={templatesContextValue}>
            {children}
          </StudioContext.Templates.Provider>
        </StudioContext.Input.Provider>
      </StudioContext.Setters.Provider>
    );
  },
);

StudioContextProvider.displayName = 'StudioContextProvider';
