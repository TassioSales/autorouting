import { getKeyboardGenerator } from "autorouting-dataset/lib/generators/keyboards"
import { expect, test } from "bun:test"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { getSimpleRouteJson } from "solver-utils"
import { MultilayerIjump } from "../../MultilayerIjump"

test("repro3: no wild trace jumps on multilayer ijump (fixes #92)", async () => {
  const soup = await getKeyboardGenerator().getExample({ seed: 7 })
  const connMap = getFullConnectivityMapFromCircuitJson(soup)
  const input = getSimpleRouteJson(soup, { layerCount: 2, connMap })

  const autorouter = new MultilayerIjump({
    input,
    connMap,
    optimizeWithGoalBoxes: true,
  })

  // Verify computeH does not return NaN
  const testNode = {
    x: 4.36,
    y: -14.095,
    l: 1,
    g: 0,
    h: 0,
    f: 0,
    parent: null,
    manDistFromParent: 0,
    nodesInPath: 0,
  } as any
  autorouter.goalPoint = input.connections[8].pointsToConnect[1] as any
  const hVal = autorouter.computeH(testNode)
  expect(Number.isNaN(hVal)).toBe(false)
  expect(Number.isFinite(hVal)).toBe(true)

  // Verify computeG does not add VIA_COST when staying on layer 1
  const sameLayerNode = { ...testNode, l: 1, g: 10 }
  const nextSameLayerNode = { ...testNode, l: 1, x: 4.36, y: -10 }
  const gSame = autorouter.computeG(sameLayerNode, nextSameLayerNode)
  expect(gSame).toBe(10 + Math.abs(-10 - -14.095))

  // Verify computeG adds VIA_COST on actual layer transition
  const viaNode = { ...testNode, l: 0, x: 4.36, y: -14.095 }
  const gVia = autorouter.computeG(sameLayerNode, viaNode)
  expect(gVia).toBe(10 + autorouter.VIA_COST)

  // Verify all connections solve and map to traces
  const result = autorouter.solveAndMapToTraces()
  expect(result.length).toBeGreaterThan(0)

  expect(
    convertCircuitJsonToPcbSvg(soup.concat(result as any) as any),
  ).toMatchSvgSnapshot(import.meta.path)
})
