import React from 'react';
import NavBar from '../NavBar';
import StatusBar from '../StatusBar';
import SkeletonItem from '../SkeletonItem';

export const ResultsPreviewSkeleton = () => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 border border-bg-border p-4 rounded">
        <div className="h-4 w-24 mb-2">
          <SkeletonItem />
        </div>
        <div className="h-4 w-68">
          <SkeletonItem />
        </div>
        <div className="h-4 w-90">
          <SkeletonItem />
        </div>
        <div className="h-4 w-52">
          <SkeletonItem />
        </div>
      </div>
      <div className="flex flex-col gap-3 border border-bg-border p-4 rounded">
        <div className="h-4 w-24 mb-2">
          <SkeletonItem />
        </div>
        <div className="h-4 w-68">
          <SkeletonItem />
        </div>
        <div className="h-4 w-90">
          <SkeletonItem />
        </div>
        <div className="h-4 w-52">
          <SkeletonItem />
        </div>
      </div>
      <div className="flex flex-col gap-3 border border-bg-border p-4 rounded">
        <div className="h-4 w-24 mb-2">
          <SkeletonItem />
        </div>
        <div className="h-4 w-68">
          <SkeletonItem />
        </div>
        <div className="h-4 w-90">
          <SkeletonItem />
        </div>
        <div className="h-4 w-52">
          <SkeletonItem />
        </div>
      </div>
      <div className="flex flex-col gap-3 border border-bg-border p-4 rounded">
        <div className="h-4 w-24 mb-2">
          <SkeletonItem />
        </div>
        <div className="h-4 w-68">
          <SkeletonItem />
        </div>
        <div className="h-4 w-90">
          <SkeletonItem />
        </div>
        <div className="h-4 w-52">
          <SkeletonItem />
        </div>
      </div>
    </div>
  );
};

const mainContainerStyle = { height: 'calc(100vh - 8rem)' };
const Skeleton = () => {
  return (
    <div className="text-label-title">
      <NavBar />
      <div
        className="flex mt-16 w-screen overflow-hidden relative"
        style={mainContainerStyle}
      >
        <div
          className={`text-label-title border-b border-r border-bg-border overflow-y-auto flex-shrink-0 ${'w-90'} transition-all duration-100 `}
        >
          <div className="w-full px-8 py-4 border-b border-bg-border">
            <div className="w-24 h-4">
              <SkeletonItem />
            </div>
          </div>
          <div
            className={`flex flex-col items-start gap-2 px-8 subhead-m py-2 border-b border-bg-border flex justify-between h-60 pb-8`}
          >
            <div className="w-72 h-12 py-4">
              <SkeletonItem />
            </div>
            <div className="h-4 w-44">
              <SkeletonItem />
            </div>
            <div className="h-4 w-full">
              <SkeletonItem />
            </div>
            <div className="h-4 w-48">
              <SkeletonItem />
            </div>
            <div className="h-4 w-36">
              <SkeletonItem />
            </div>
            <div className="h-4 w-72">
              <SkeletonItem />
            </div>
          </div>
          <div
            className={`flex flex-col items-start gap-2 px-8 subhead-m py-2 border-b border-bg-border flex justify-between h-60 pb-8`}
          >
            <div className="w-72 h-12 py-4">
              <SkeletonItem />
            </div>
            <div className="h-4 w-44">
              <SkeletonItem />
            </div>
            <div className="h-4 w-full">
              <SkeletonItem />
            </div>
            <div className="h-4 w-48">
              <SkeletonItem />
            </div>
            <div className="h-4 w-36">
              <SkeletonItem />
            </div>
            <div className="h-4 w-72">
              <SkeletonItem />
            </div>
          </div>
          <div
            className={`flex flex-col items-start gap-2 px-8 subhead-m py-2 border-b border-bg-border justify-between h-60 pb-8`}
          >
            <div className="w-72 h-12 py-4">
              <SkeletonItem />
            </div>
            <div className="h-4 w-44">
              <SkeletonItem />
            </div>
            <div className="h-4 w-full">
              <SkeletonItem />
            </div>
            <div className="h-4 w-48">
              <SkeletonItem />
            </div>
            <div className="h-4 w-36">
              <SkeletonItem />
            </div>
            <div className="h-4 w-72">
              <SkeletonItem />
            </div>
          </div>
        </div>
        <div className="pt-8 px-8 pb-0 flex-1 overflow-x-auto mx-auto max-w-6.5xl box-content">
          <div>
            <div className="flex flex-col gap-1 h-12">
              <div className="h-4 w-48">
                <SkeletonItem />
              </div>
              <div className="h-2 w-48">
                <SkeletonItem />
              </div>
            </div>
          </div>
          <ResultsPreviewSkeleton />
        </div>
      </div>
      <StatusBar />
    </div>
  );
};

export default Skeleton;
