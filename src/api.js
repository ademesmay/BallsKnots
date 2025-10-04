// Bridges your JS scene/state to Python (Pyodide).
// We expose a tiny JS module "applet_api" to Python.



function positionsToString(arr, digits = 6) {
  const fmt = (n) => {
    const v = Number(n);
    return Number.isFinite(v) ? v.toFixed(digits) : "null";
  };
  return "[" + arr.map(p => "[" + p.map(fmt).join(",") + "]").join(",") + "]";
}

export async function initPyodideAndAPI(chainAPI, defaultPyTextAreaId = 'py-pane') {
  const pyodide = await loadPyodide();

  // ---- Build the module we expose to Python ----
  const apiModule = {
    // Positions (raw)
    get_positions: () => chainAPI.getPositions(),
    set_positions: (arr) => chainAPI.setPositions(arr),

    // Constraints / projection
    project_constraints: (iters = 20) => chainAPI.projectConstraints(iters),

    // Distances / checks
    compute_distances: (indices) => chainAPI.computeDistances(indices),

    // Ratio & count
    set_ratio: (val) => chainAPI.setRatio(val),
    get_ratio: () => chainAPI.getRatio(),
    set_ball_count: (n) => chainAPI.setBallCount(n),
    get_ball_count: () => chainAPI.getBallCount(),

    // Presets
    set_preset: (name) => chainAPI.setPreset(name),

    // ===== Copy/paste helpers =====
    // 1) Get positions as a pasteable string: [[x,y,z], ...]
    get_positions_str: (digits = 6) => positionsToString(chainAPI.getPositions(), digits),

    // 2) Return a ready-to-paste line: api.set_positions([[...], ...])
    print_set_positions_snippet: (digits = 6) =>
      `api.set_positions(${positionsToString(chainAPI.getPositions(), digits)})`,

    // 3) Set positions from a string: '[[...],[...],...]'
    set_positions_from_str: (s) => {
      try {
        const arr = JSON.parse(s);
        chainAPI.setPositions(arr);
        return true;
      } catch {
        return false;
      }
    },
  };

  // --- Back-compat / ergonomic aliases (optional but handy) ---
  apiModule.setPreset = apiModule.set_preset;  // camelCase alias
  apiModule.getPositions = apiModule.get_positions;
  apiModule.setPositions = apiModule.set_positions;
  apiModule.getPositionsStr = apiModule.get_positions_str;
  apiModule.setPositionsFromStr = apiModule.set_positions_from_str;
  apiModule.projectConstraints = apiModule.project_constraints;
  apiModule.computeDistances = apiModule.compute_distances;
  apiModule.setBallCount = apiModule.set_ball_count;
  apiModule.getBallCount = apiModule.get_ball_count;
  apiModule.setRatio = apiModule.set_ratio;
  apiModule.getRatio = apiModule.get_ratio;

  pyodide.registerJsModule('applet_api', apiModule);

  // ---- Default Python script with a full API catalog ----
  const defaultScript = `
import applet_api as api

# ===========================================
# Applet Python API (quick reference)
# -------------------------------------------
# Positions:
#   api.get_positions() -> list[list[float, float, float]]
#   api.set_positions(positions: list[list[float, float, float]]) -> None
#   api.get_positions_str(digits=6) -> str               # '[[x,y,z], ...]'
#   api.set_positions_from_str(s: str) -> bool           # parse and apply
#   api.print_set_positions_snippet(digits=6) -> str     # 'api.set_positions([[...], ...])'
#
# Constraints / solver:
#   api.project_constraints(iters=20) -> None            # enforces tangencies, etc.
#
# Measurements:
#   api.compute_distances(indices: list[int]) -> list[[i,j,d]]
#
# Ratio & ball count:
#   api.get_ratio() -> float
#   api.set_ratio(val: float) -> None                    # clamped [0.8, 1.0]; UI syncs
#   api.get_ball_count() -> int
#   api.set_ball_count(n: int) -> None                   # clamped [2, 60]; UI syncs
#
# Presets:
#   api.set_preset(name: str) -> None                    # 'default11', 'trefoil11', 'figure8_16',
#                                                        # 'double_overhand_18', 'stevedore_22'
#
# Aliases (camelCase also available):
#   setPreset, getPositions, setPositions, getPositionsStr,
#   setPositionsFromStr, projectConstraints, computeDistances,
#   setBallCount, getBallCount, setRatio, getRatio
# ===========================================

# Example: print a ready-to-paste setter line for later reuse
print(api.print_set_positions_snippet(6))

# Example: small projection step to settle constraints
# api.project_constraints(40)

# Example: change ratio and ball count (UI will update too)
# api.set_ratio(0.975)
# api.set_ball_count(16)

# Example: apply a preset
# api.set_preset('figure8_16')
`;

  const ta = document.getElementById(defaultPyTextAreaId);
  if (ta && !ta.value.trim()) ta.value = defaultScript;

  // ---- Python runner ----
  window.__runPython = async (code) => {
    await pyodide.runPythonAsync(code);
  };
}
