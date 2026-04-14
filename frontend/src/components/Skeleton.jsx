export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="glass p-5">
      <div className="skeleton h-5 w-2/3 mb-3" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-3 w-full mb-2" />
      ))}
    </div>
  );
}

export function SkeletonLine({ className = '' }) {
  return <div className={`skeleton h-3 ${className}`} />;
}
