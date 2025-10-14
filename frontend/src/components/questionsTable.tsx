import { cn } from "@/lib/utils";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  selectedIndex: number | null;
  setSelectedIndex: (index: number | null) => void;
}

export function QuestionsTable<TData, TValue>({
  columns,
  data,
  selectedIndex,
  setSelectedIndex,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: (select) => {
      const key = Object.keys(
        typeof select === "function" ? select({}) : select,
      );

      setSelectedIndex(key.length === 0 ? null : Number(key[0]));
    },
    state: {
      rowSelection: selectedIndex == null ? {} : { [selectedIndex]: true },
    },
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header, i) => (
              <TableHead
                key={header.id}
                className={cn("bg-neutral-200", { "pl-3": i === 0 })}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && "selected"}
              onClick={() => row.toggleSelected(true)}
            >
              {row.getVisibleCells().map((cell, i) => (
                <TableCell key={cell.id} className={cn({ "pl-3": i === 0 })}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-24 text-center">
              No results.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
