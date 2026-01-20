/**
 * CSV Template Download
 * 
 * GET /api/controllers/csv-template - Download CSV template for manual data upload
 */

import { NextResponse } from 'next/server'

const CSV_TEMPLATE = `timestamp,temperature,humidity,vpd,co2,light
2026-01-20T06:00:00Z,75.5,60,0.95,450,0
2026-01-20T07:00:00Z,76.0,58,1.02,480,15000
2026-01-20T08:00:00Z,77.2,55,1.15,520,35000
2026-01-20T09:00:00Z,78.5,52,1.25,600,45000
2026-01-20T10:00:00Z,79.0,50,1.30,650,48000
2026-01-20T11:00:00Z,80.2,48,1.42,700,50000
2026-01-20T12:00:00Z,81.0,47,1.50,750,52000
2026-01-20T13:00:00Z,80.5,48,1.45,720,50000
2026-01-20T14:00:00Z,79.8,50,1.38,680,48000
2026-01-20T15:00:00Z,79.0,52,1.30,650,45000
2026-01-20T16:00:00Z,78.0,54,1.20,600,35000
2026-01-20T17:00:00Z,77.0,56,1.12,550,20000
2026-01-20T18:00:00Z,76.0,58,1.02,500,5000
2026-01-20T19:00:00Z,75.0,60,0.95,450,0
2026-01-20T20:00:00Z,74.0,62,0.88,420,0`

export async function GET() {
  return new NextResponse(CSV_TEMPLATE, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="enviroflow-sensor-template.csv"'
    }
  })
}
