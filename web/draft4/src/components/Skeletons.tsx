import { BOARD_COLS } from "./Board";

/** Skeletons at the final sizes (components.md States): no zeros, no fake numbers. */
export function TilesSkeleton() {
  return (
    <div className="grid grid-cols-2 border-b border-line sm:grid-cols-4" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="border-line p-2 max-sm:border-b max-sm:[&:nth-child(odd)]:border-r sm:border-r sm:last:border-r-0">
          <div className="rounded-xl px-4 py-3 compact:py-2.5">
            <div className="skel h-4 w-20 rounded" />
            <div className="skel mt-2.5 h-8 w-28 rounded-md compact:h-7" />
            <div className="skel mt-2 h-3 w-16 rounded" />
            <div className="skel mt-3 h-7 w-full rounded-md compact:hidden max-sm:hidden" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div aria-hidden>
      <div className={`${BOARD_COLS} mb-[5px] h-[48px] compact:h-10`}>
        <span />
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex flex-col items-center justify-end gap-1 pb-1">
            <span className="skel h-2.5 w-6 rounded" />
            <span className="skel h-3 w-4 rounded" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-[10px] compact:gap-2">
        {[0, 1, 2].map((g) => (
          <div key={g} className={`${BOARD_COLS} gap-y-[5px] compact:gap-y-[4px]`}>
            {Array.from({ length: 3 }, (_, r) => (
              <div key={r} className="contents">
                <span className="flex items-center justify-end">
                  <span className="skel h-3 w-6 rounded" />
                </span>
                {Array.from({ length: 7 }, (_, c) => (
                  <span key={c} className="skel h-8 rounded-[9px] sm:h-9 compact:h-[30px] min-[112.5rem]:h-[42px] min-[160rem]:h-11" />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="flex flex-col gap-0 px-5 pt-4" aria-hidden>
      <div className="skel h-4 w-24 rounded" />
      <div className="mt-5 flex flex-col">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex h-11 items-center gap-3">
            <span className="skel size-1.5 rounded-[2px]" />
            <span className="skel h-3.5 flex-1 rounded" />
            <span className="skel h-3.5 w-10 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ rows = false }: { rows?: boolean }) {
  return (
    <div aria-hidden className="flex h-full flex-col">
      <div className="skel h-3 w-20 rounded" />
      <div className="skel mt-2 h-5 w-32 rounded" />
      {rows ? (
        <div className="mt-4 flex flex-col">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex h-11 items-center gap-3">
              <span className="skel h-3.5 flex-1 rounded" />
              <span className="skel h-3.5 w-10 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="skel mt-4 min-h-[220px] flex-1 rounded-xl" />
      )}
    </div>
  );
}
