import { useCallback } from 'react';
import { ArrowLeft } from '../../../icons';
import ShareButton, { ShareFile } from '../../ShareButton';
import SearchInput from '../../SearchInput';
import Button from '../../Button';
import useAppNavigation from '../../../hooks/useAppNavigation';

type Props = {
  shareFiles?: ShareFile[];
  isSkeleton?: boolean;
};

const NavBarUser = ({ shareFiles, isSkeleton }: Props) => {
  const { navigateBack, navigationHistory } = useAppNavigation();

  const backButtonHandler = useCallback(() => {
    navigateBack();
  }, []);

  return (
    <div className="flex flex-row flex-1">
      <Button
        variant={'tertiary'}
        onlyIcon
        title={'Back'}
        disabled={!navigationHistory.length}
        className={!navigationHistory.length ? 'opacity-0' : ''}
        onClick={backButtonHandler}
      >
        <ArrowLeft />
      </Button>
      <div className="flex items-center justify-between	w-full">
        <span />
        {/*{isSkeleton ? (*/}
        {/*  <div className="bg-gray-700 rounded-4 h-7 w-32" />*/}
        {/*) : (*/}
        {/*  <Dropdown*/}
        {/*    items={[*/}
        {/*      {*/}
        {/*        text: 'Untitled search',*/}
        {/*        icon: <Tab />,*/}
        {/*        type: MenuListItemType.DEFAULT,*/}
        {/*      },*/}
        {/*      {*/}
        {/*        text: 'Untitled search',*/}
        {/*        icon: <Tab />,*/}
        {/*        type: MenuListItemType.DEFAULT,*/}
        {/*      },*/}
        {/*      {*/}
        {/*        text: 'Untitled search',*/}
        {/*        icon: <Tab />,*/}
        {/*        type: MenuListItemType.DEFAULT,*/}
        {/*      },*/}
        {/*      {*/}
        {/*        text: 'New tab',*/}
        {/*        icon: <PlusSignInBubble />,*/}
        {/*        type: MenuListItemType.DEFAULT,*/}
        {/*      },*/}
        {/*    ]}*/}
        {/*    hint={'Open tabs'}*/}
        {/*  />*/}
        {/*)}*/}
        <div className="flex items-center">
          {isSkeleton ? (
            <>
              <div className="bg-gray-700 rounded-4 h-7 w-68 mr-2" />
              <div className="bg-gray-700 rounded-4 h-7 w-32" />
            </>
          ) : (
            <SearchInput />
          )}
        </div>
        {shareFiles?.length ? <ShareButton files={shareFiles} visible /> : ''}
        <span />
      </div>
    </div>
  );
};
export default NavBarUser;
