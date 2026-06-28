export function UsersListSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-4 px-2 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-gray-200 rounded w-32" />
            <div className="h-2.5 bg-gray-100 rounded w-24" />
          </div>
          <div className="h-6 bg-gray-200 rounded-full w-16" />
          <div className="h-6 bg-gray-100 rounded-full w-20" />
          <div className="h-6 bg-gray-200 rounded-full w-12" />
          <div className="flex gap-2">
            <div className="w-8 h-8 bg-gray-100 rounded-lg" />
            <div className="w-8 h-8 bg-gray-100 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
