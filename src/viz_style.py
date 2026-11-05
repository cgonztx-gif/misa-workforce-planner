"""The shared chart look for the report and the notebook, read from design/tokens.json (D-26).

    from src import viz_style as vs
    vs.apply()                                   # once, before drawing (dpi=200 for print)
    fig, ax = plt.subplots(figsize=(6.5, 3))
    ax.plot(x, plan, **vs.PLAN_LINE, label="Plan")
    ax.plot(x, bench, **vs.BENCHMARK_LINE, label="Benchmark")
    vs.label_line_end(ax, ax.lines[0])           # direct label at the last point
    vs.header(ax, "Hours by day")                # title and small key above, flush left (call last)

    Bars: set the category axis' limits, then vs.bars(ax, x, values, color=vs.PLAN, offset=off) per series
    with offsets from vs.group_offsets(ax, n), then vs.zero_based(ax). They are capped at 24px with a
    2px gap and a 4px rounded data end, like the app's.

Tokens are CSS px; print and matplotlib use points, so every size goes through `pt(px) = px * 0.75`.
Segoe UI Regular has tabular digits by default, so ticks and table-like labels line up without a
font feature (matplotlib can't switch OpenType features). Semibold digits are proportional, which
suits a standalone number. Change a color or size in design/tokens.json, never here.
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib as mpl
from cycler import cycler
from matplotlib import font_manager
from matplotlib.colors import BoundaryNorm, LinearSegmentedColormap, ListedColormap
from matplotlib.container import BarContainer
from matplotlib.legend_handler import HandlerPatch, update_from_first_child
from matplotlib.lines import Line2D
from matplotlib.path import Path as MplPath
from matplotlib.patches import FancyBboxPatch, Rectangle
from matplotlib.ticker import FuncFormatter
from matplotlib.transforms import IdentityTransform, offset_copy

TOKENS_PATH = Path(__file__).resolve().parents[1] / "design" / "tokens.json"
TOKENS: dict = json.loads(TOKENS_PATH.read_text(encoding="utf-8"))


def pt(px: float) -> float:
    """Token px to points (1 CSS px = 0.75 pt)."""
    return px * 0.75


def _tok(group: str, name: str):
    return TOKENS[group][name]["value"]


# Colors: every token color by name, plus the roles charts use most.
COLORS: dict[str, str] = {name: entry["value"] for name, entry in TOKENS["color"].items()}
SURFACE, CANVAS, RAISED, BORDER = COLORS["surface"], COLORS["canvas"], COLORS["raised"], COLORS["border"]
INK, INK_MUTED, INK_SUBTLE = COLORS["ink"], COLORS["ink_muted"], COLORS["ink_subtle"]
ACCENT, ACCENT_SOFT = COLORS["accent"], COLORS["accent_soft"]
PLAN, DRAFT, DRAFT_SOFT, BENCHMARK = COLORS["plan"], COLORS["draft"], COLORS["draft_soft"], COLORS["benchmark"]
GOOD, WARNING, RISK = COLORS["good"], COLORS["warning"], COLORS["risk"]
GOOD_SOFT, WARNING_SOFT, RISK_SOFT = COLORS["good_soft"], COLORS["warning_soft"], COLORS["risk_soft"]
GOOD_INK, WARNING_INK, RISK_INK = COLORS["good_ink"], COLORS["warning_ink"], COLORS["risk_ink"]
NAVY = COLORS["navy"]
GRID, AXIS, TICK, LABEL = (_tok("chart", k) for k in ("grid", "axis", "tick", "label"))
BAND, BAND_NEUTRAL = _tok("chart", "band"), _tok("chart", "band_neutral")

# Departments in their fixed order. Color follows the department, never its rank.
_DEPTS = TOKENS["scale"]["departments"]
DEPT: dict[str, str] = {name: COLORS[key] for key, name in zip(_DEPTS["order"], _DEPTS["names"])}

# Sizes in points.
TICK_SIZE, LABEL_SIZE, TITLE_SIZE = (pt(_tok("chart", k)) for k in ("tick_size", "label_size", "title_size"))
LINE_WIDTH, LINE_WIDTH_PLAN = pt(_tok("chart", "line_width")), pt(_tok("chart", "line_width_plan"))
MARKER_SIZE, RING = pt(_tok("chart", "marker_size")), pt(2)
HAIRLINE = pt(_tok("shape", "border_width"))
BAR_MAX_WIDTH, BAR_RADIUS, BAR_GAP = (_tok("chart", k) for k in ("bar_max_width", "bar_radius", "bar_gap"))  # px
AREA_ALPHA = _tok("chart", "area_opacity")
BENCHMARK_DASH = tuple(pt(v) for v in _tok("chart", "benchmark_dash"))  # (on, off) in points
BENCHMARK_LINESTYLE = (0, BENCHMARK_DASH)

# Ready-made series styles: ax.plot(x, y, **PLAN_LINE, label="Plan").
PLAN_LINE = {"color": PLAN, "linewidth": LINE_WIDTH_PLAN, "zorder": 4}
DRAFT_LINE = {"color": DRAFT, "linewidth": LINE_WIDTH, "zorder": 3}
BENCHMARK_LINE = {"color": BENCHMARK, "linewidth": LINE_WIDTH, "linestyle": BENCHMARK_LINESTYLE, "zorder": 3}
MARKERS = {"marker": "o", "markersize": MARKER_SIZE, "markeredgecolor": SURFACE, "markeredgewidth": RING}

# Scales: stops light to dark, the ink a printed number takes on each stop, and colormaps.
_CHANCE, _CHANGE = TOKENS["scale"]["chance"], TOKENS["scale"]["change"]
CHANCE_STOPS, CHANCE_BREAKS, CHANCE_LABELS, CHANCE_INK = (_CHANCE[k] for k in ("stops", "breaks", "labels", "label_ink"))
CHANGE_STOPS, CHANGE_VALUES, CHANGE_LABELS, CHANGE_INK = (_CHANGE[k] for k in ("stops", "values", "labels", "label_ink"))
CHANCE_CMAP = ListedColormap(CHANCE_STOPS, name="wp_chance")  # stepped, with CHANCE_NORM (share 0 to 1)
CHANCE_NORM = BoundaryNorm([0.0, *CHANCE_BREAKS, 1.0], CHANCE_CMAP.N)
CHANGE_CMAP = ListedColormap(CHANGE_STOPS, name="wp_change")  # stepped, with CHANGE_NORM (people vs draft)
CHANGE_NORM = BoundaryNorm([v - 0.5 for v in CHANGE_VALUES] + [CHANGE_VALUES[-1] + 0.5], CHANGE_CMAP.N, clip=True)
CHANCE_CMAP_SMOOTH = LinearSegmentedColormap.from_list("wp_chance_smooth", CHANCE_STOPS)


def chance_color(share: float) -> tuple[str, str]:
    """(fill, number ink) for a chance of meeting target, 0 to 1."""
    i = sum(share >= b for b in CHANCE_BREAKS)
    return CHANCE_STOPS[i], CHANCE_INK[i]


def change_color(delta: float) -> tuple[str, str]:
    """(fill, number ink) for a change in people vs the draft; beyond +-3 uses the end stops."""
    i = int(max(min(round(delta), CHANGE_VALUES[-1]), CHANGE_VALUES[0])) - CHANGE_VALUES[0]
    return CHANGE_STOPS[i], CHANGE_INK[i]


def _font() -> str:
    family = _tok("type", "family_office")
    try:
        font_manager.findfont(family, fallback_to_default=False)
        return family
    except ValueError:
        return "DejaVu Sans"


FONT = _font()


def apply(dpi: int = 200) -> None:
    """Set matplotlib's rcParams to the shared look. dpi=200 for the report; ~110 suits a notebook."""
    mpl.rcParams.update({
        "font.family": "sans-serif", "font.sans-serif": [FONT, "DejaVu Sans"],
        "font.size": LABEL_SIZE, "text.color": INK, "axes.unicode_minus": True,
        "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
        "figure.dpi": dpi, "savefig.dpi": dpi, "savefig.bbox": "tight", "savefig.pad_inches": 0.06,
        "axes.edgecolor": AXIS, "axes.linewidth": HAIRLINE, "axes.labelcolor": TICK, "axes.labelsize": LABEL_SIZE,
        "axes.labelpad": 6, "axes.titlesize": TITLE_SIZE, "axes.titleweight": "semibold", "axes.titlecolor": INK,
        "axes.titlelocation": "left", "axes.titlepad": 10,
        "axes.spines.top": False, "axes.spines.right": False, "axes.spines.left": False,
        "axes.grid": True, "axes.grid.axis": "y", "axes.axisbelow": True,
        "axes.prop_cycle": cycler(color=[PLAN, *DEPT.values()]),
        "grid.color": GRID, "grid.linewidth": HAIRLINE, "grid.linestyle": "-",
        "xtick.color": AXIS, "ytick.color": AXIS, "xtick.labelcolor": TICK, "ytick.labelcolor": TICK,
        "xtick.labelsize": TICK_SIZE, "ytick.labelsize": TICK_SIZE,
        "xtick.major.size": 0, "ytick.major.size": 0, "xtick.minor.size": 0, "ytick.minor.size": 0,
        "xtick.major.pad": 5, "ytick.major.pad": 4,
        "lines.linewidth": LINE_WIDTH, "lines.markersize": MARKER_SIZE, "lines.markeredgewidth": RING,
        "lines.markeredgecolor": SURFACE, "lines.solid_capstyle": "round", "lines.solid_joinstyle": "round",
        "lines.dash_capstyle": "butt", "lines.scale_dashes": False,
        "legend.frameon": False, "legend.fontsize": LABEL_SIZE, "legend.labelcolor": INK_MUTED,
        "legend.handlelength": 1.4, "legend.handleheight": 0.7, "legend.handletextpad": 0.5,
        "legend.columnspacing": 1.4, "legend.borderaxespad": 0.2, "legend.borderpad": 0,
        "patch.linewidth": 0, "svg.fonttype": "none",
    })


# Helpers -----------------------------------------------------------------------------------------

def formatter(template: str) -> FuncFormatter:
    """Tick formatter from a format string on `x`, with a true minus and no "+0": formatter("{x:+.0f}%")."""
    def _format(x: float, _pos=None) -> str:
        return template.format(x=0.0 if abs(x) < 1e-9 else x).replace("+0%", "0%").replace("-", "−")
    return FuncFormatter(_format)


def zero_based(ax, top: float | None = None, axis: str = "y") -> None:
    """Start the value axis at zero, as every bar and column axis must (F-60). `top` fixes the far end."""
    get, set_ = (ax.get_ylim, ax.set_ylim) if axis == "y" else (ax.get_xlim, ax.set_xlim)
    set_(0, top if top is not None else max(get()[1], 0))


def bar_width(ax, px: float = BAR_MAX_WIDTH, axis: str = "x") -> float:
    """Size in data units along `axis` of a mark `px` thick (default: the bar cap). Set that axis' limits first."""
    box = ax.get_position()
    if axis == "x":
        span_pt, (lo, hi) = box.width * ax.figure.get_figwidth() * 72, ax.get_xlim()
    else:
        span_pt, (lo, hi) = box.height * ax.figure.get_figheight() * 72, ax.get_ylim()
    return abs(hi - lo) * pt(px) / span_pt


def group_offsets(ax, n: int, px: float = BAR_MAX_WIDTH, axis: str = "x") -> list[float]:
    """Offsets for n touching bars per category, each `px` thick with the 2px surface gap between them."""
    step = bar_width(ax, px, axis) + bar_width(ax, BAR_GAP, axis)
    return [(i - (n - 1) / 2) * step for i in range(n)]


class _Bar(Rectangle):
    """A bar with a rounded data end (chart.bar_radius) and a square baseline end.

    The outline is built in display space at draw time, so corners stay circular whatever the axes'
    aspect, while the plain Rectangle underneath keeps autoscaling and ax.bar_label() working.
    """

    def __init__(self, xy, width, height, radius_px, horizontal, **kw):
        super().__init__(xy, width, height, **kw)
        self._radius, self._horizontal, self._display_path = pt(radius_px), horizontal, None

    def get_path(self):
        return self._display_path if self._display_path is not None else super().get_path()

    def get_transform(self):
        return IdentityTransform() if self._display_path is not None else super().get_transform()

    def draw(self, renderer):
        (xa, ya), (xb, yb) = super().get_transform().transform([(0, 0), (1, 1)])  # baseline corner, data-end corner
        # Work in (across, along) coordinates: along runs from the baseline to the data end.
        base, end, lo, hi = (xa, xb, min(ya, yb), max(ya, yb)) if self._horizontal else (ya, yb, min(xa, xb), max(xa, xb))
        r = min(renderer.points_to_pixels(self._radius), (hi - lo) / 2, abs(end - base))
        s, k = (1 if end >= base else -1), 0.5523 * r
        pts = [(lo, base), (lo, end - s * r), (lo, end - s * (r - k)), (lo + r - k, end), (lo + r, end),
               (hi - r, end), (hi - r + k, end), (hi, end - s * (r - k)), (hi, end - s * r), (hi, base), (lo, base)]
        verts = [(u, v) for v, u in pts] if self._horizontal else pts
        c4, line = MplPath.CURVE4, MplPath.LINETO
        self._display_path = MplPath(verts, [MplPath.MOVETO, line, c4, c4, c4, line, c4, c4, c4, line, MplPath.CLOSEPOLY])
        try:
            super().draw(renderer)
        finally:
            self._display_path = None


def bars(ax, pos, values, *, color: str = PLAN, offset: float = 0.0, thickness: float | None = None,
         horizontal: bool = False, label: str | None = None, zorder: float = 2) -> BarContainer:
    """Bars from zero with a rounded data end, capped at chart.bar_max_width thick.

    Set the category axis' limits first (the cap is converted to data units from them). Side by side:
    pass each series an offset from group_offsets(ax, n). Returns a BarContainer, so ax.bar_label()
    and the legend work as with ax.bar(). Then call zero_based(ax) on the value axis.
    """
    thickness = thickness if thickness is not None else bar_width(ax, axis="y" if horizontal else "x")
    patches = []
    for p, v in zip(pos, values):
        c = p + offset - thickness / 2
        xy, w, h = ((0, c), v, thickness) if horizontal else ((c, 0), thickness, v)
        patch = _Bar(xy, w, h, BAR_RADIUS, horizontal, facecolor=color, linewidth=0, zorder=zorder)
        ax.add_patch(patch)
        patches.append(patch)
    container = BarContainer(patches, datavalues=list(values), orientation="horizontal" if horizontal else "vertical", label=label)
    ax.add_container(container)
    ax.autoscale_view()
    return container


def label_point(ax, x, y, text: str, dx: float = 0, dy: float = 7, ha: str = "center", va: str = "bottom",
                color: str = LABEL, **kw):
    """A direct label beside a data point, offset in points, in label ink (text never wears series color)."""
    kw.setdefault("fontsize", LABEL_SIZE)
    return ax.annotate(text, (x, y), xytext=(dx, dy), textcoords="offset points", ha=ha, va=va,
                       color=color, annotation_clip=False, **kw)


def label_line_end(ax, line, text: str | None = None, dx: float = 6, dy: float = 0, **kw):
    """Label a line at its last point, to the right (dataviz: lines take their value at the end)."""
    return label_point(ax, line.get_xdata()[-1], line.get_ydata()[-1], text or line.get_label(),
                       dx=dx, dy=dy, ha="left", va="center", **kw)


LEGEND_LIFT = TICK_SIZE * 0.6 + 6  # points between the plot's top edge and the key


def _key(handle):
    """A legend key without the surface ring, which would cut a line key into dashes: a line keeps its
    color, width and dash and drops its marker; a marker-only series keeps a plain dot."""
    if not isinstance(handle, Line2D):
        return handle
    key = Line2D([], [])
    key.update_from(handle)
    if handle.get_linestyle() in ("None", "none", "", " "):
        key.set_markeredgewidth(0)
    else:
        key.set_marker("None")
    return key


def _swatch(legend, orig_handle, xdescent, ydescent, width, height, fontsize):
    """A bar series' key: a small rounded square, like the app's and the deck's legends."""
    side = min(width, height * 1.15)
    return FancyBboxPatch((-xdescent, -ydescent + (height - side) / 2), side, side,
                          boxstyle=f"round,pad=0,rounding_size={side * 0.25}")


def legend_top(ax, handles=None, labels=None, x: float = 0.0, **kw):
    """A small one-row key above the plot, left aligned at axes-fraction x, like the app's chart cards."""
    if handles is None:
        handles, labels = ax.get_legend_handles_labels()
    handles = [_key(h) for h in handles]
    kw.setdefault("ncol", len(handles))
    kw.setdefault("handler_map", {BarContainer: HandlerPatch(patch_func=_swatch, update_func=update_from_first_child)})
    if all(isinstance(h, BarContainer) for h in handles):
        kw.setdefault("handlelength", 0.8)
    lift = offset_copy(ax.transAxes, ax.figure, y=LEGEND_LIFT, units="points")  # clears the top tick label
    return ax.legend(handles, labels, loc="lower left", bbox_to_anchor=(x, 1.0), bbox_transform=lift, **kw)


def header(ax, title: str | None = None, legend: bool = True):
    """Title and key above the plot, flush with the left edge of the y labels, like a card header.

    Call it last, after ticks and labels are set (it measures them). Returns the title Text or None.
    """
    fig = ax.figure
    left = ax.yaxis.get_tightbbox(fig.canvas.get_renderer()).x0
    x = ax.transAxes.inverted().transform((left, 0))[0]
    if legend and ax.get_legend_handles_labels()[0]:
        legend_top(ax, x=x)
    if not title:
        return None
    lift = (LEGEND_LIFT + LABEL_SIZE * 1.4 + 6) if legend else LEGEND_LIFT
    return ax.text(x, 1.0, title, transform=offset_copy(ax.transAxes, fig, y=lift, units="points"),
                   fontsize=TITLE_SIZE, fontweight="semibold", color=INK, ha="left", va="bottom")


def band(ax, x0: float, x1: float, text: str | None = None, color: str = BAND, ink: str = LABEL):
    """A shaded vertical span (holiday, surge, the cliff), named in text at its top."""
    ax.axvspan(x0, x1, color=color, linewidth=0, zorder=0)
    if text:
        ax.text((x0 + x1) / 2, 0.97, text, transform=ax.get_xaxis_transform(), ha="center", va="top",
                fontsize=LABEL_SIZE, color=ink)
