import React from 'react';

const SkeletonLoader: React.FC = () => {
  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-6 animate-pulse mt-8">
      {/* Header/Nav Placeholder */}
      <div className="flex justify-between items-center mb-12">
        <div className="h-8 bg-slate-200 rounded w-48" />
        <div className="h-8 bg-slate-200 rounded w-24" />
      </div>

      {/* Composer Area Placeholder */}
      <div className="space-y-3">
        <div className="h-4 bg-slate-200 rounded w-1/4" />
        <div className="h-64 bg-slate-100 rounded-xl w-full border border-slate-200" />
      </div>

      {/* Preview Areas Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-40 bg-slate-50 rounded-lg w-full border border-slate-100" />
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-40 bg-slate-50 rounded-lg w-full border border-slate-100" />
        </div>
      </div>

      {/* Footer/Reference Toolbar Placeholder */}
      <div className="flex space-x-4 pt-8">
        <div className="h-10 bg-slate-200 rounded w-32" />
        <div className="h-10 bg-slate-200 rounded w-32" />
        <div className="h-10 bg-slate-200 rounded w-32" />
      </div>
    </div>
  );
};

export default SkeletonLoader;
