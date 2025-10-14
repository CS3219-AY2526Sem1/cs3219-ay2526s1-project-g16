import { QN_SERVICE_URL } from "@/constants";
import { cn } from "@/lib/utils";
import type { ColumnType } from "@/routes/_authenticated/manage-questions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Trash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

interface DataTableProps {
  data: ColumnType[];
  selectedIndex: number | null;
  setSelectedIndex: (index: number | null) => void;
  removeTempNewQuestion: (index: number) => void;
}

export function QuestionsTable({
  data,
  selectedIndex,
  setSelectedIndex,
  removeTempNewQuestion,
}: DataTableProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`${QN_SERVICE_URL}/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["questions"] });
      toast.success("Question successfully deleted!");
    },
    onError: (error) => {
      toast.error(`Error deleting question: ${(error as Error).message}`);
    },
  });

  const columns: ColumnDef<ColumnType>[] = [
    { accessorKey: "id", header: "ID", accessorFn: (row) => row.id ?? "" },
    {
      accessorKey: "title",
      header: "Title",
      accessorFn: (row) => (row.id == null ? "New Question" : row.title),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          className="text-destructive bg-destructive/10 hover:bg-destructive/20"
          size="icon"
          type="button"
          disabled={mutation.isPending}
          onClick={(e) => {
            e.stopPropagation();
            if (row.original.id == null) {
              removeTempNewQuestion(row.index);
              return;
            }
            mutation.mutate(row.original.id);
          }}
        >
          <Trash />
        </Button>
      ),
    },
  ];

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
              className={cn({
                "bg-green-50 text-neutral-500": row.original.id == null,
              })}
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
