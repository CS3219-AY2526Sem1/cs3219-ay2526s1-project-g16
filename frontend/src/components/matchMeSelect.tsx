import { cn } from "@/lib/utils";
import { CirclePlus, CircleX } from "lucide-react";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export function MatchMeSelect({
  placeholder,
  choices,
  triggerClassName,
  itemClassName,
  item,
  setItem,
}: {
  placeholder: string;
  choices: { value: string; label: string }[];
  triggerClassName?: string;
  itemClassName?: string;
  item: string;
  setItem: React.Dispatch<React.SetStateAction<string>>;
}) {
  return (
    <Select value={item} onValueChange={(newValue) => setItem(newValue)}>
      <SelectTrigger
        className={cn(
          "before:outline-solid relative mx-2 border-0 border-b-neutral-200 px-0 text-3xl shadow-none transition-colors before:absolute before:-inset-1 before:-z-10 before:-mx-1 before:rounded-lg before:outline-transparent before:transition-colors hover:before:bg-neutral-100/50 hover:before:outline-neutral-300/50 focus-visible:ring-0 data-[state=open]:before:bg-neutral-100/50 data-[state=open]:before:outline-neutral-300/80",
          triggerClassName,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="item-aligned" className="bg-accent">
        {choices.map(({ value, label }, i) => (
          <SelectItem
            key={i}
            value={value}
            className={cn(
              "data-[state=checked]:bg-popover/70 focus:!bg-popover text-3xl transition-colors",
              itemClassName,
            )}
          >
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MultiMatchMeSelect({
  placeholder,
  choices,
  triggerClassName,
  itemClassName,
  items,
  setItems,
}: {
  placeholder: string;
  choices: { value: string; label: string }[];
  triggerClassName?: string;
  itemClassName?: string;
  items: string[];
  setItems: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  return (
    <div className="relative mr-10 flex flex-wrap gap-y-2">
      {items.map((value, i) => (
        <div
          className={cn("relative", {
            "[&:hover>svg]:opacity-100": items.length > 1,
          })}
        >
          <Select
            key={i}
            value={value}
            onValueChange={(newValue) =>
              setItems((prev) =>
                prev.map((v, idx) => (idx === i ? newValue : v)),
              )
            }
          >
            <SelectTrigger
              className={cn(
                "before:outline-solid relative mx-2 border-0 border-b-neutral-200 px-0 text-3xl shadow-none transition-colors before:absolute before:-inset-1 before:-z-10 before:-mx-1 before:rounded-lg before:outline-transparent before:transition-colors hover:before:bg-neutral-100/50 hover:before:outline-neutral-300/50 focus-visible:ring-0 data-[state=open]:before:bg-neutral-100/50 data-[state=open]:before:outline-neutral-300/80",
                { "animate-in fade-in slide-in-from-left-6": i !== 0 },
                triggerClassName,
              )}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent position="item-aligned" className="bg-accent">
              {choices.map(({ value, label }, i) => (
                <SelectItem
                  key={i}
                  value={value}
                  className={cn(
                    "data-[state=checked]:bg-popover/70 focus:!bg-popover text-3xl transition-colors",
                    itemClassName,
                  )}
                >
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CircleX
            className="absolute -right-3 -top-3 rounded-full bg-white text-red-500 opacity-0 transition-opacity"
            onClick={() =>
              setItems((prev) =>
                prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev,
              )
            }
          />
        </div>
      ))}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setItems((prev) => [...prev, ""])}
      >
        <CirclePlus className="text-accent-foreground" />
      </Button>
    </div>
  );
}
