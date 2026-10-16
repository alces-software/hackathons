export function PageHead({
  kicker,
  title,
  lede,
}: {
  kicker?: string;
  title: string;
  lede?: string;
}) {
  return (
    <header className="mx-auto max-w-6xl px-4 pt-10 pb-8 sm:px-6 sm:pt-14">
      {kicker && <p className="label">{kicker}</p>}
      <h1 className="font-display mt-2 text-[2.9rem] font-semibold uppercase leading-[0.95] tracking-[0.05em] sm:text-6xl">
        {title}
      </h1>
      {lede && (
        <p className="mt-4 max-w-xl text-[0.86rem] text-ink-soft">{lede}</p>
      )}
      <div className="mt-9 border-b-2 border-ink" />
    </header>
  );
}