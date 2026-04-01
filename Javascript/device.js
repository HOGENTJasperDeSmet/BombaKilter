import { KilterBoard, KilterBoardPlacementRoles } from "@hangtime/grip-connect"
import { data } from "./auroraBoardData"
import { ClimbStore } from "./ClimbStore"
import { databaseReady } from './main.js';
import Hammer from 'hammerjs';

const btn = document.getElementById('bluetooth-btn');
const info = document.getElementById('page-info');
const device = new KilterBoard()

const COORDINATE_MULTIPLIER = 7.5
const DELTA_X = 0
const DELTA_Y = 1170

let activeHolds = []

const svg = document.querySelector("#svg-kb")

if (svg) {
  const circles = circle()
  circles.forEach((circle) => svg.appendChild(circle))
}

async function bootBoard() {
  await databaseReady;

  const currentUrl = new URL(globalThis.location.href);
  const routeParam = currentUrl.searchParams.get("route");

  if (routeParam) {
    loadRouteFromURL();
  }
}

bootBoard();

globalThis.addEventListener("popstate", () => {
  loadRouteFromURL();
});


function setFrames(routeParam) {
  const newRoleMatches = routeParam.match(/h(\d+)r(\d+)/g)
  const newColorMatches = routeParam.match(/h(\d+)c([0-9A-Fa-f]{6})/g)

  const oldRoleMatches = routeParam.match(/p(\d+)r(\d+)/g)
  const oldColorMatches = routeParam.match(/p(\d+)c([0-9A-Fa-f]{6})/g)

  if (!newRoleMatches && !newColorMatches && !oldRoleMatches && !oldColorMatches) {
    console.error("No valid route patterns found in the routeParam.")
    return
  }

  activeHolds.length = 0

  if (newRoleMatches) {
    newRoleMatches.forEach((match) => {
      const [, holes_id, role_id] = match.match(/h(\d+)r(\d+)/) || []

      if (holes_id && role_id) {
        const holesId = parseInt(holes_id, 10)
        const row = data.find((r) => r[2] === holesId)
        if (row) {
          activeHolds.push({
            placement_id: row[4],
            holes_id: holesId,
            role_id: parseInt(role_id, 10),
          })
        }
      }
    })
  }

  if (newColorMatches) {
    newColorMatches.forEach((match) => {
      const [, holes_id, color] = match.match(/h(\d+)c([0-9A-Fa-f]{6})/) || []

      if (holes_id && color) {
        const holesId = parseInt(holes_id, 10)
        const row = data.find((r) => r[2] === holesId)
        if (row) {
          activeHolds.push({
            placement_id: row[4],
            holes_id: holesId,
            color: color.toUpperCase(),
          })
        }
      }
    })
  }

  if (oldRoleMatches) {
    oldRoleMatches.forEach((match) => {
      const [, placement_id, role_id] = match.match(/p(\d+)r(\d+)/) || []

      if (placement_id && role_id) {
        const placementId = parseInt(placement_id, 10)
        const row = data.find((row) => row[4] === placementId)
        if (row) {
          activeHolds.push({
            placement_id: placementId,
            holes_id: row[2],
            role_id: parseInt(role_id, 10),
          })
        }
      }
    })
  }

  if (oldColorMatches) {
    oldColorMatches.forEach((match) => {
      const [, placement_id, color] = match.match(/p(\d+)c([0-9A-Fa-f]{6})/) || []

      if (placement_id && color) {
        const placementId = parseInt(placement_id, 10)
        const row = data.find((row) => row[4] === placementId)
        if (row) {
          activeHolds.push({
            placement_id: placementId,
            holes_id: row[2],
            color: color.toUpperCase(),
          })
        }
      }
    })
  }
}
function selectRoute(id) {

  const urlParams = new URLSearchParams(window.location.search);
  urlParams.set("route", id);

  const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
  window.history.pushState({ path: newUrl }, '', newUrl);

  loadRouteFromURL();
};

function closeRoute() {
  const urlParams = new URLSearchParams(window.location.search);
  urlParams.delete("route");

  const queryString = urlParams.toString();
  const newUrl = window.location.pathname + (queryString ? `?${queryString}` : '');

  window.history.pushState({ path: newUrl }, '', newUrl);
  loadRouteFromURL();
}

function navigateRoute(direction) {
  const urlParams = new URLSearchParams(window.location.search);
  const currentId = urlParams.get("route");

  const allRoutes = ClimbStore.getAll();
  const currentIndex = allRoutes.findIndex(r => r.id == currentId);

  if (currentIndex === -1) return;

  let newIndex;
  if (direction === 'next') {
    newIndex = (currentIndex + 1) % allRoutes.length;
  } else {
    newIndex = (currentIndex - 1 + allRoutes.length) % allRoutes.length;
  }

  const nextRoute = allRoutes[newIndex];
  if (nextRoute) {
    if (!document.startViewTransition) {
      selectRoute(nextRoute.id);
      return;
    }

    // The Magic Happens Here
    document.startViewTransition(() => {
      selectRoute(nextRoute.id);
    });
  }
}

export function initSwipeGestures() {
  const boardElement = document.getElementById('main-board');
  if (!boardElement) return;

  const mc = new Hammer(boardElement);

  mc.get('swipe').set({
    direction: Hammer.DIRECTION_HORIZONTAL,
    threshold: 10,
    velocity: 0.3
  });

  mc.on("swipeleft", () => {
    console.log("Next route...");
    navigateRoute('next');
  });

  mc.on("swiperight", () => {
    console.log("Previous route...");
    navigateRoute('prev');
  });
}
document.addEventListener('DOMContentLoaded', initSwipeGestures);

function loadRouteFromURL() {
  const urlParams = new URLSearchParams(globalThis.location.search);
  const routeParam = urlParams.get("route");
  const board = document.getElementById('main-board');

  if (routeParam) {
    if (board) board.classList.add('active');
  } else {
    if (board) board.classList.remove('active');
    clearSVG();
    return;
  }

  if (routeParam !== getFrames()) {
    var route = ClimbStore.getRouteById(routeParam)


    renderRouteDetails(route);

    clearSVG();
    setFrames(route.frames);
    updateSVG();

    if (typeof updatePayload === "function") {
      updatePayload();
    }
  }
}
function renderRouteDetails(route) {
  if (!route) return;

  const nameEl = document.getElementById('route-name');
  const setterEl = document.getElementById('route-setter');
  const descEl = document.getElementById('route-description');
  const angleEl = document.getElementById('route-angle');

  if (nameEl) nameEl.textContent = route.name || "Untitled Route";
  if (setterEl) setterEl.textContent = `@${route.setter_username || "unknown"}`;

  if (descEl) {
    descEl.textContent = route.description || "No description provided.";
  }
  if (angleEl) {
    angleEl.textContent = `${route.angle || "unknown"}°`;
  }
}
function updateSVG() {
  activeHolds.forEach((hold) => {
    const circleId = hold.holes_id !== undefined ? `hold-${hold.holes_id}` : undefined
    const circle = circleId ? document.getElementById(circleId) : null

    if (circle) {
      let color = null

      if (hold.color) {
        color = hold.color
      } else if (hold.role_id) {
        const role = KilterBoardPlacementRoles.find((role) => role.id === hold.role_id)
        if (role) {
          color = role.screen_color
        }
      }

      if (color) {
        circle.setAttribute("stroke", "#" + color)
        circle.setAttribute("fill", "#" + color)
      } else {
        circle.setAttribute("stroke", "transparent")
        circle.setAttribute("fill", "transparent")
      }
    }
  })
}


function getFrames() {
  const frames = []
  for (const activeHold of activeHolds) {
    if (!activeHold.holes_id) continue

    if (activeHold.color) {
      frames.push(`h${activeHold.holes_id}c${activeHold.color}`)
    } else if (activeHold.role_id !== undefined) {
      frames.push(`h${activeHold.holes_id}r${activeHold.role_id}`)
    }
  }
  return frames.join("")
}

function updateURL() {
  const routeParam = getFrames()
  const currentUrl = new URL(globalThis.location.href)

  currentUrl.searchParams.set("route", routeParam)

  globalThis.history.pushState({}, "", currentUrl)
}

function clearSVG() {
  activeHolds.forEach((hold) => {
    const circleId = hold.holes_id !== undefined ? `hold-${hold.holes_id}` : undefined
    const circle = circleId ? document.getElementById(circleId) : null

    if (circle) {
      circle.setAttribute("stroke", "transparent")
      circle.setAttribute("fill", "transparent")
    }
  })
}

function dbToBoardCoord(x, y) {
  return {
    x: x * COORDINATE_MULTIPLIER + DELTA_X,
    y: -y * COORDINATE_MULTIPLIER + DELTA_Y,
  }
}

function generateKilterboardColors() {
  const colors = []

  // 8 red levels, 8 green levels, 4 blue levels = 256 total colors
  for (let rBits = 0; rBits < 8; rBits++) {
    for (let gBits = 0; gBits < 8; gBits++) {
      for (let bBits = 0; bBits < 4; bBits++) {
        // Convert back to full RGB - use the midpoint of each range so colors look better
        const red = Math.min(255, rBits * 32 + 16)
        const green = Math.min(255, gBits * 32 + 16)
        const blue = Math.min(255, bBits * 64 + 32)

        // Convert to hex (uppercase, no # prefix)
        const hex = [
          red.toString(16).toUpperCase().padStart(2, "0"),
          green.toString(16).toUpperCase().padStart(2, "0"),
          blue.toString(16).toUpperCase().padStart(2, "0"),
        ].join("")

        colors.push(hex)
      }
    }
  }

  return colors
}


async function updatePayload() {
  const activeHoldsHtml = document.querySelector("#active-holds")

  if (activeHolds.length === 0) {
    if (activeHoldsHtml) {
      activeHoldsHtml.innerHTML = ""
    }
    return
  }

  const placement = activeHolds
    .map((activeHold) => {
      const filteredRow = data.find((row) => row[4] === activeHold.placement_id)
      if (!filteredRow) {
        throw new Error(`Row with id ${activeHold.placement_id} not found in placement_roles`)
      }
      if (activeHold.color && typeof activeHold.color === "string" && activeHold.color.trim() !== "") {
        return {
          position: filteredRow[3],
          color: activeHold.color.trim(),
        }
      } else if (
        activeHold.role_id !== undefined &&
        activeHold.role_id !== null &&
        typeof activeHold.role_id === "number"
      ) {
        return {
          position: filteredRow[3],
          role_id: activeHold.role_id,
        }
      } else {
        return null
      }
    })
    .filter((p) => p !== null)

  let payload
  if (device instanceof KilterBoard) {
    payload = await device.led(placement)
  }

  if (activeHoldsHtml !== null && payload) {
    const payloadHex = payload.map((x) => zfill(x.toString(16), 2)).join("")
    activeHoldsHtml.innerHTML = payloadHex
  }
}
function zfill(input, number) {
  const pad = "0".repeat(number)
  return pad.substring(0, pad.length - input.length) + input
}

function circle() {
  return data.map((item) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
    const coordinate = dbToBoardCoord(item[0], item[1])
    circle.setAttribute("cx", coordinate.x.toString())
    circle.setAttribute("cy", coordinate.y.toString())
    circle.setAttribute("r", "30")
    circle.setAttribute("fill", "transparent")
    circle.setAttribute("stroke", "transparent")
    circle.setAttribute("stroke-width", "6")
    circle.setAttribute("cursor", "pointer")
    circle.setAttribute("fill-opacity", "0")
    circle.setAttribute("data-holes-id", item[2].toString())
    circle.setAttribute("data-led-position", item[3]?.toString())
    circle.setAttribute("id", `hold-${item[2]}`)
    circle.addEventListener("click", (event) => {
      const targetElement = event.target

      const currentStroke = targetElement?.getAttribute("stroke")?.replace("#", "")

      const currentRoleIndex = KilterBoardPlacementRoles.findIndex((role) => role.screen_color === currentStroke)

      const nextRoleIndex = currentRoleIndex + 1
      const nextRole = KilterBoardPlacementRoles[nextRoleIndex] || null

      if (nextRole) {
        targetElement?.setAttribute("stroke", "#" + nextRole.screen_color)
        targetElement?.setAttribute("fill", "#" + nextRole.screen_color)

        const newHoldData = {
          role_id: nextRole.id,
          placement_id: item[4],
          holes_id: item[2],
        }

        const holdIndex = activeHolds.findIndex((hold) => hold.holes_id === newHoldData.holes_id)
        if (holdIndex === -1) {
          activeHolds.push(newHoldData)
        } else {
          activeHolds[holdIndex] = newHoldData
        }
      } else {
        targetElement?.setAttribute("stroke", "transparent")
        targetElement?.setAttribute("fill", "transparent")

        activeHolds = activeHolds.filter((hold) => hold.holes_id !== item[2])
      }

      updateURL()
      updatePayload()
    })

    return circle
  })

}

const BoardState = {
  IDLE: "IDLE",
  BOOTING: "BOOTING",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
}
let currentState = BoardState.IDLE

let reader
let API_LEVEL = -1

let currentPacketLength = -1
let currentPacket = []
let allPacketsReceived = false

function newByteIn(dataByte) {
  if (allPacketsReceived) {
    allPacketsReceived = false
    clearSVG()
    activeHolds = []
  }

  if (currentPacket.length === 0 && dataByte !== 1) return

  currentPacket.push(dataByte)

  if (currentPacket.length === 2) {
    currentPacketLength = dataByte + 5
  } else if (currentPacket.length === currentPacketLength) {
    if (verifyAndParsePacket()) {
      allPacketsReceived = isThisTheLastPacket()
    } else {
      clearSVG()
      activeHolds = []
    }

    currentPacket = []
    currentPacketLength = -1
  }
}

function scaledColorToFullColorV3(holdData) {
  const fullColor = [0, 0, 0]

  // Extract RGB from the packed byte: RRRGGGBB format
  // Red is bits 5-7
  fullColor[0] = Math.round((((holdData & 0b11100000) >> 5) / 7) * 255)

  // Green is bits 2-4
  fullColor[1] = Math.round((((holdData & 0b00011100) >> 2) / 7) * 255)

  // Blue is bits 0-1
  fullColor[2] = Math.round((((holdData & 0b00000011) >> 0) / 3) * 255)

  // Convert to hex string
  const hexColor = fullColor.map((value) => value.toString(16).toUpperCase().padStart(2, "0")).join("")

  return hexColor
}

function parseCurrentPacketToActiveHolds() {
  clearSVG()
  activeHolds.length = 0

  const startIndex = 5

  if (API_LEVEL < 3) {
    for (let i = startIndex; i < currentPacketLength - 1; i += 2) {
      const position = currentPacket[i] + ((currentPacket[i + 1] & 0b11) << 8)
      const roleId = currentPacket[i + 1] // Role ID might be in a specific part of the packet based on API level
      console.log(position, roleId)
      // Find the role ID and position from the currentPacket data
      const filteredRow = data.find((row) => row[3] === position)
      if (filteredRow) {
        activeHolds.push({
          placement_id: filteredRow[4],
          role_id: roleId,
        })
      }
    }
  } else {
    for (let i = startIndex; i < currentPacketLength - 1; i += 3) {
      const position = (currentPacket[i + 1] << 8) + currentPacket[i]
      const colorPacked = scaledColorToFullColorV3(currentPacket[i + 2])

      const roleId = KilterBoardPlacementRoles.find((role) => role.led_color === colorPacked)?.id

      const filteredRow = data.find((row) => row[3] === position)
      if (filteredRow && roleId) {
        activeHolds.push({
          placement_id: filteredRow[4],
          role_id: roleId,
        })
      }
    }
  }
  updateSVG()
  updatePayload()
  updateURL()
}

async function setupDevice(element) {
  await device.connect(async () => {
    const placement = activeHolds
      .map((activeHold) => {
        const filteredRow = data.find((row) => row[4] === activeHold.placement_id)
        if (!filteredRow) {
          throw new Error(`Row with id ${activeHold.placement_id} not found in placement_roles`)
        }
        const entry = {
          position: filteredRow[3],
        }

        if (activeHold.role_id !== undefined) {
          entry.role_id = activeHold.role_id
        }

        if (activeHold.color) {
          entry.color = activeHold.color
        }

        if (entry.role_id === undefined && entry.color === undefined) {
          return null
        }

        return entry
      })
      .filter((entry) => entry !== null)

    if (device instanceof KilterBoard) {
      await device.led(placement)
    }

    btn.classList.add('connected');
    info.innerText = "Connected";
    info.style.color = "#3b82f6";
  })
}

window.setupDevice = setupDevice;
window.selectRoute = selectRoute;
window.closeRoute = closeRoute;

export { selectRoute, setupDevice, closeRoute, navigateRoute };

function verifyAndParsePacket() {


  parseCurrentPacketToActiveHolds()

  return true
}

/** Check if this is the last packet in the sequence */
function isThisTheLastPacket() {
  // Check the 4th byte of the message to determine if it's the last packet
  if (API_LEVEL < 3) {
    return currentPacket[4] === 80 || currentPacket[4] === 79
  } else {
    return currentPacket[4] === 84 || currentPacket[4] === 83
  }
}
