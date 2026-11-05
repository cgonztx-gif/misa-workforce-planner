// Shared components for every page. Import from "../components".
export { Card, type CardProps } from "./ui/Card";
export { PageHeader, type PageHeaderProps } from "./ui/PageHeader";
export { KpiTile, KpiRow, DeltaChip, type KpiTileProps, type DeltaChipProps } from "./ui/KpiTile";
export { Badge, SwatchLabel, type BadgeProps, type Tone } from "./ui/Badge";
export { SegmentedControl, type SegmentedControlProps, type SegmentOption } from "./ui/SegmentedControl";
export { DataTable, type Column, type DataTableProps } from "./ui/DataTable";
export { Drawer, DrawerSection, type DrawerProps } from "./ui/Drawer";
export { Tooltip, HelpTip, TooltipProvider, type TooltipProps, type HelpTipProps } from "./ui/Tooltip";
export { Skeleton, SkeletonCard, Refreshing } from "./ui/Skeleton";
export { EmptyState, type EmptyStateProps } from "./ui/EmptyState";
export { ErrorPanel, CommandBlock, START_COMMANDS, DATA_COMMANDS, type ErrorPanelProps } from "./ui/ErrorPanel";
export { Button, LinkButton, type ButtonProps, type LinkButtonProps } from "./ui/Button";
export {
  chartColors,
  DEPT_COLORS,
  deptColor,
  chanceFill,
  changeFill,
  CHART_HEIGHT,
  chartMargin,
  gridProps,
  xAxisProps,
  yAxisProps,
  zeroDomain,
  lineProps,
  barProps,
  barGap,
  bandProps,
  tooltipProps,
  barTooltipProps,
  tooltipContent,
  ChartTooltip,
  ChartLegend,
  legendItems,
  type LegendItem,
  type ChartTooltipProps,
} from "./charts/chartTheme";
export { PagePlaceholder } from "./PagePlaceholder";
