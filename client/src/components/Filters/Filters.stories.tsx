import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { UIContextProvider } from '../../context/providers/UiContextProvider';
import { RepoSource } from '../../types';
import FilterSection from './FilterSection';
import Filters from './index';

export default {
  title: 'components/Filters',
  component: Filters,
};

const initialSections = [
  {
    title: 'Repository',
    name: 'repos',
    items: [
      { label: 'shamu-rsh', description: '3,500', checked: false },
      { label: 'migrations', description: '12', checked: false },
      { label: 'client-apps', description: '1,300', checked: false },
      {
        label: 'symbol-resolve-parser',
        description: '12,000',
        checked: false,
      },
    ],
    type: 'checkbox' as const,
  },
  {
    title: 'Language',
    name: 'lang',
    items: [
      { label: 'JavaScript', description: '3,500', checked: false },
      { label: 'TypeScript', description: '12', checked: false },
      { label: 'Rust', description: '1,300', checked: false },
      {
        label: 'Python',
        description: '12,000',
        checked: false,
      },
    ],
    type: 'checkbox' as const,
  },
];

export const Default = () => {
  return (
    <MemoryRouter initialEntries={['']}>
      <UIContextProvider
        tab={{
          name: 'bloop',
          key: 'bloop',
          repoName: 'bloop',
          navigationHistory: [],
          source: RepoSource.LOCAL,
          currentUrl: '',
        }}
      >
        <div style={{ width: 350 }}>
          <Filters />
        </div>
      </UIContextProvider>
    </MemoryRouter>
  );
};

export const Checkboxes = () => {
  const [items, setItems] = useState([
    { label: 'shamu-rsh', description: '3,500', checked: false },
    { label: 'migrations', description: '12', checked: false },
    { label: 'client-apps', description: '1,300', checked: false },
    { label: 'symbol-resolve-parser', description: '12,000', checked: false },
  ]);
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div style={{ width: 350 }}>
      <FilterSection
        items={items}
        onChange={(i, b) => {
          const newItems = [...items];
          newItems[i].checked = b;
          setItems(newItems);
        }}
        type="checkbox"
        name="repos"
        title="Repository"
        open={isOpen}
        onToggle={() => setIsOpen((prev) => !prev)}
        onSelectAll={(b) => {
          setItems((prev) => prev.map((i) => ({ ...i, checked: b })));
        }}
      />
    </div>
  );
};

export const ClickableLines = () => {
  const [items, setItems] = useState([
    { label: 'shamu-rsh', description: '3,500', checked: false },
    { label: 'migrations', description: '12', checked: false },
    { label: 'client-apps', description: '1,300', checked: false },
    { label: 'symbol-resolve-parser', description: '12,000', checked: false },
  ]);
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div style={{ width: 350 }}>
      <FilterSection
        items={items}
        onChange={(i, b) => {
          const newItems = [...items];
          newItems[i].checked = b;
          setItems(newItems);
        }}
        type="button"
        name="repos"
        title="Repository"
        open={isOpen}
        onToggle={() => setIsOpen((prev) => !prev)}
        onSelectAll={(b) => {
          setItems((prev) => prev.map((i) => ({ ...i, checked: b })));
        }}
      />
    </div>
  );
};
