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
          "relative text-3xl border-0 border-b-neutral-200 shadow-none px-0 mx-2 focus-visible:ring-0 transition-colors before:absolute before:-inset-1 before:-mx-1 before:outline-solid before:outline-transparent hover:before:outline-neutral-300/50 before:transition-colors before:rounded-lg hover:before:bg-neutral-100/50 before:-z-10 data-[state=open]:before:bg-neutral-100/50 data-[state=open]:before:outline-neutral-300/80",
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
              "text-3xl data-[state=checked]:bg-popover/70 focus:!bg-popover transition-colors",
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
    <div className="relative flex flex-wrap gap-y-2 mr-10">
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
                "relative text-3xl border-0 border-b-neutral-200 shadow-none px-0 mx-2 focus-visible:ring-0 transition-colors before:absolute before:-inset-1 before:-mx-1 before:outline-solid before:outline-transparent hover:before:outline-neutral-300/50 before:transition-colors before:rounded-lg hover:before:bg-neutral-100/50 before:-z-10 data-[state=open]:before:bg-neutral-100/50 data-[state=open]:before:outline-neutral-300/80",
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
                    "text-3xl data-[state=checked]:bg-popover/70 focus:!bg-popover transition-colors",
                    itemClassName,
                  )}
                >
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CircleX
            className="text-red-500 absolute -top-3 -right-3 bg-white rounded-full opacity-0 transition-opacity"
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
