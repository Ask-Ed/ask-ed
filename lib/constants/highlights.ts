export interface HighlightColor {
  id: string;
  name: string;
  bg: string;
  border: string;
  hover: string;
}

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  {
    id: 'yellow',
    name: 'Yellow',
    bg: 'bg-yellow-200/60 dark:bg-yellow-400/20',
    border: 'border-yellow-300 dark:border-yellow-500',
    hover: 'hover:bg-yellow-300/70 dark:hover:bg-yellow-400/30'
  },
  {
    id: 'blue',
    name: 'Blue', 
    bg: 'bg-blue-200/60 dark:bg-blue-400/20',
    border: 'border-blue-300 dark:border-blue-500',
    hover: 'hover:bg-blue-300/70 dark:hover:bg-blue-400/30'
  },
  {
    id: 'green',
    name: 'Green',
    bg: 'bg-emerald-200/60 dark:bg-emerald-400/20', 
    border: 'border-emerald-300 dark:border-emerald-500',
    hover: 'hover:bg-emerald-300/70 dark:hover:bg-emerald-400/30'
  },
  {
    id: 'pink',
    name: 'Pink',
    bg: 'bg-rose-200/60 dark:bg-rose-400/20',
    border: 'border-rose-300 dark:border-rose-500', 
    hover: 'hover:bg-rose-300/70 dark:hover:bg-rose-400/30'
  },
  {
    id: 'purple',
    name: 'Purple',
    bg: 'bg-violet-200/60 dark:bg-violet-400/20',
    border: 'border-violet-300 dark:border-violet-500',
    hover: 'hover:bg-violet-300/70 dark:hover:bg-violet-400/30'
  }
];


export function getHighlightColor(colorId: string): HighlightColor {
  return HIGHLIGHT_COLORS.find(c => c.id === colorId) || HIGHLIGHT_COLORS[0];
}