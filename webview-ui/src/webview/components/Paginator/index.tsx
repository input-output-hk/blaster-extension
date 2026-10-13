interface Props {
  index: number;
  total: number;
  onChange: (i: number) => void;
}

const Paginator: React.FC<Props> = ({ index, total, onChange }) => (
  <div className="flex items-center gap-1">
    <button
      onClick={() => onChange(index - 1)}
      disabled={index === 0}
      className="cursor-pointer disabled:opacity-30 flex items-center px-1 text-base-06"
    >
      <i className="codicon codicon-chevron-left text-[12px]" />
    </button>
    {Array.from({ length: total }, (_, i) => (
      <button
        key={i}
        onClick={() => onChange(i)}
        className={`rounded-full px-2 py-0.5 text-[11px] cursor-pointer transition-colors ${
          i === index
            ? "bg-blue-07 text-base-01"
            : "bg-base-15 text-base-06 hover:bg-base-14"
        }`}
      >
        {i + 1}
      </button>
    ))}
    <button
      onClick={() => onChange(index + 1)}
      disabled={index === total - 1}
      className="cursor-pointer disabled:opacity-30 flex items-center px-1 text-base-06"
    >
      <i className="codicon codicon-chevron-right text-[12px]" />
    </button>
  </div>
);

export default Paginator;
