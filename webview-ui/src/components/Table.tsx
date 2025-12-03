'use client';
import type {ComponentProps} from 'react';
import cn from '../utils/styleUtil';



function TableContainer({ ...props}: ComponentProps<'div'>) {
    return <div className={cn('w-full h-full flex flex-col bg-containerLowest border-outline/50 border')} {...props} />;
}

export default function Table({ ...props}: ComponentProps<'table'>) {
    return <div className='overflow-auto flex-1'>
      <table className={cn('w-full text-sm border-collapse')} {...props} />
    </div>;
}

function TableHeader({ ...props }: ComponentProps<"thead">) {
  return (
    <thead
      className={cn("bg-containerLowest sticky top-0")}
      {...props}>
      <tr>
        {props.children}
      </tr>
    </thead>
  );
}

function TableBody({ ...props }:ComponentProps<"tbody">) {
  return (
    <tbody
      {...props}
    />
  );
}

function TableFooter({ ...props }: ComponentProps<"tfoot">) {
  return (
    <tfoot
      {...props}
    />
  );
}

function TableRow({ ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn("border-outline/50 border-b odd:bg-containerLow")}
      {...props}
    />
  );
}

function TableHead({ ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn("p-2 pl-5 pr-5 white/80 font-medium text-left whitespace-nowrap")}
      {...props}
    />
  );
}

function TableCell({ ...props }: ComponentProps<"td">) {
  return (
    <td
      className={cn("p-2 pl-5 pr-5 white/90 whitespace-nowrap")}
      {...props}
    />
  );
}

Table.Container = TableContainer;
Table.Header = TableHeader;
Table.Body = TableBody;
Table.Footer = TableFooter;
Table.Row = TableRow;
Table.Head = TableHead;
Table.Cell = TableCell;
