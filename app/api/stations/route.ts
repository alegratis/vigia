import { NextResponse } from "next/server"
import { STATIONS, DEPARTMENT } from "@/lib/geoglows/stations"

/** List the monitored stations in the priority study area. */
export function GET() {
  return NextResponse.json({
    department: DEPARTMENT,
    count: STATIONS.length,
    stations: STATIONS,
  })
}
