import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Header from './Header';
import Body from './Body';
import Footer from './Footer';
import { getContextItems, getProjectItems } from './items';

type Props = {};

const InitialCommandBar = ({}: Props) => {
  const { t } = useTranslation();

  const initialSections = useMemo(() => {
    const contextItems = getContextItems(t);
    return [
      { items: contextItems, itemsOffset: 0, label: t('Manage context') },
      {
        items: getProjectItems(t),
        itemsOffset: contextItems.length,
        label: t('Recent projects'),
      },
    ];
  }, [t]);

  return (
    <div className="w-full flex flex-col max-h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header breadcrumbs={['Default project']} />
      <Body sections={initialSections} />
      <Footer />
    </div>
  );
};

export default memo(InitialCommandBar);
