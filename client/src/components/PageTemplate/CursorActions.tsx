import React, { useState } from 'react';
import useCoCursor from '../../hooks/useCoCursor';
import Button from '../Button';
import TextInput from '../TextInput';

const CursorActions = () => {
  const [searchForRegex, setSearchForRegex] = useState('');
  const [searchForNL, setSearchForNL] = useState('');
  const [selectLines, setSelectLines] = useState('');
  const [resultToOpen, setResultToOpen] = useState('');
  const { selectText, makeRegexSearch, makeNLSearch, openResult } =
    useCoCursor();
  return (
    <div className="fixed z-70 top-20 left-1 bg-gray-900 rounded border border-gray-800 flex flex-col gap-2 p-3">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          makeRegexSearch(searchForRegex);
        }}
      >
        <TextInput
          name="searchForRegex"
          placeholder="Make regex search for:"
          value={searchForRegex}
          onChange={(e) => setSearchForRegex(e.target.value)}
        />
        <Button
          size="small"
          variant="tertiary"
          onlyIcon
          title="Search"
          type="submit"
        >
          Ok
        </Button>
      </form>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          makeNLSearch(searchForNL);
        }}
      >
        <TextInput
          name="searchForNL"
          placeholder="Make NL search for:"
          value={searchForNL}
          onChange={(e) => setSearchForNL(e.target.value)}
        />
        <Button
          size="small"
          variant="tertiary"
          onlyIcon
          title="Search"
          type="submit"
        >
          Ok
        </Button>
      </form>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          openResult(Number(resultToOpen));
        }}
      >
        <TextInput
          name="resultToOpen"
          placeholder="Open result #"
          value={resultToOpen}
          onChange={(e) => setResultToOpen(e.target.value)}
        />
        <Button
          size="small"
          variant="tertiary"
          onlyIcon
          title="Open"
          type="submit"
        >
          Ok
        </Button>
      </form>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          // @ts-ignore
          selectText(...selectLines.split('-').map((l) => Number(l)));
        }}
      >
        <TextInput
          name="selectLines"
          placeholder="Select text in full code (l1-l2)"
          value={selectLines}
          onChange={(e) => setSelectLines(e.target.value)}
        />
        <Button
          size="small"
          variant="tertiary"
          onlyIcon
          title="Select"
          type="submit"
        >
          Ok
        </Button>
      </form>
    </div>
  );
};

export default CursorActions;
