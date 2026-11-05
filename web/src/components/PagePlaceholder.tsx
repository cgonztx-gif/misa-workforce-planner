import { Hammer } from "lucide-react";
import { useViewNames } from "../lib/hooks";
import { Card } from "./ui/Card";
import { PageHeader } from "./ui/PageHeader";

/** Temporary page body until the page is built (T-82 to T-88). Lists what the page will hold. */
export function PagePlaceholder({ title, answer, items }: { title: string; answer: string; items: string[] }) {
  const { scenario, warehouseName } = useViewNames();
  return (
    <>
      <PageHeader title={title} answer={answer} meta={<span>{scenario}, {warehouseName}</span>} />
      <Card title="Being built" description="This page is next in the build order. It will show:" actions={<Hammer className="size-5 text-ink-subtle" aria-hidden />}>
        <ul className="grid gap-x-8 gap-y-2 text-base text-ink-muted md:grid-cols-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
