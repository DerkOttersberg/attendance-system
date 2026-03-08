import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { AttendanceRecord } from '../types'

type FloorplanLegendItem = {
  user: string
  desk: string
  room: string
  slot: string
}

function naturalDeskSort(a: string, b: string) {
  const normalize = (value: string) => value.trim().toLowerCase()
  const parts = (value: string) => normalize(value).match(/([a-z]+|\d+)/g) ?? []
  const aParts = parts(a)
  const bParts = parts(b)
  const max = Math.max(aParts.length, bParts.length)

  for (let i = 0; i < max; i += 1) {
    const aPart = aParts[i] ?? ''
    const bPart = bParts[i] ?? ''
    const aNum = Number(aPart)
    const bNum = Number(bPart)
    const aIsNum = !Number.isNaN(aNum) && aPart !== ''
    const bIsNum = !Number.isNaN(bNum) && bPart !== ''

    if (aIsNum && bIsNum) {
      if (aNum !== bNum) return aNum - bNum
      continue
    }

    if (aPart !== bPart) return aPart.localeCompare(bPart)
  }

  return 0
}

export function calculateDagdelen(workDurationMinutes?: number | null) {
  if (!workDurationMinutes) return 1
  const hours = workDurationMinutes / 60
  return hours >= 4 ? 2 : 1
}

async function renderSignatureImage(signatureData: string) {
  if (!signatureData) return null

  const tempDiv = document.createElement('div')
  tempDiv.style.width = '180px'
  tempDiv.style.height = '70px'
  tempDiv.style.position = 'absolute'
  tempDiv.style.left = '-9999px'
  tempDiv.style.display = 'flex'
  tempDiv.style.alignItems = 'center'
  tempDiv.style.justifyContent = 'center'
  tempDiv.innerHTML = signatureData
    .replace(/<svg/, '<svg viewBox="0 0 550 270" preserveAspectRatio="xMidYMid meet"')
    .replace(/width="550"/, 'width="100%"')
    .replace(/height="270"/, 'height="100%"')
  document.body.appendChild(tempDiv)

  try {
    const canvas = await html2canvas(tempDiv, { backgroundColor: '#ffffff' })
    return canvas.toDataURL('image/png')
  } catch {
    return null
  } finally {
    document.body.removeChild(tempDiv)
  }
}

async function loadLogoDataUrl() {
  try {
    const response = await fetch('/images/zeeuwsezorg.png')
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function generatePDFWithLayout(records: AttendanceRecord[], periodText: string, selectedUser?: string) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const logoDataUrl = await loadLogoDataUrl()

  const addHeader = (yPos: number) => {
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', pageWidth - 50, 10, 40, 25)
      } catch {
        return yPos
      }
    }

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Presentie', 14, 20)

    return yPos
  }

  let yPos = addHeader(30)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Periode ${periodText}`, 14, yPos)
  yPos += 10

  doc.setDrawColor(100, 100, 100)
  doc.line(14, yPos, pageWidth - 14, yPos)
  yPos += 8

  const recordsByUser: Record<string, AttendanceRecord[]> = {}
  records.forEach((record) => {
    const userName = record.name
    if (!recordsByUser[userName]) {
      recordsByUser[userName] = []
    }
    recordsByUser[userName].push(record)
  })

  const col1X = 14
  const col2X = 50
  const col3X = 85
  const col4X = 120
  const col5X = 155
  const rowHeight = 6

  for (const [userName, userRecords] of Object.entries(recordsByUser)) {
    if (userRecords.length === 0) continue

    if (yPos > pageHeight - 100) {
      doc.addPage()
      yPos = addHeader(30)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`Periode ${periodText}`, 14, yPos)
      yPos += 10
      doc.setDrawColor(100, 100, 100)
      doc.line(14, yPos, pageWidth - 14, yPos)
      yPos += 8
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(`Client: ${userName}`, 14, yPos)
    yPos += 8

    const userDepartment = userRecords[0]?.department || '-'
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Financieringvorm: ${userDepartment}`, 14, yPos)
    yPos += 7

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(240, 240, 240)

    doc.rect(col1X, yPos, col2X - col1X - 2, rowHeight, 'F')
    doc.rect(col2X, yPos, col3X - col2X - 2, rowHeight, 'F')
    doc.rect(col3X, yPos, col4X - col3X - 2, rowHeight, 'F')
    doc.rect(col4X, yPos, col5X - col4X - 2, rowHeight, 'F')
    doc.rect(col5X, yPos, pageWidth - col5X - 14, rowHeight, 'F')

    doc.text('datum', col1X + 2, yPos + 4)
    doc.text('aantal', col2X + 2, yPos + 4)
    doc.text('eendheden', col3X + 2, yPos + 4)
    doc.text('product', col4X + 2, yPos + 4)
    doc.text('signature', col5X + 2, yPos + 4)

    yPos += rowHeight

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)

    let totalDagdelen = 0

    for (const record of userRecords) {
      if (yPos > pageHeight - 50) {
        doc.addPage()
        yPos = addHeader(30)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.text(`Periode ${periodText}`, 14, yPos)
        yPos += 10
        doc.setDrawColor(100, 100, 100)
        doc.line(14, yPos, pageWidth - 14, yPos)
        yPos += 8

        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(`Client: ${userName}`, 14, yPos)
        yPos += 8

        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.text(`Financieringvorm: ${userDepartment}`, 14, yPos)
        yPos += 7

        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setFillColor(240, 240, 240)
        doc.rect(col1X, yPos, col2X - col1X - 2, rowHeight, 'F')
        doc.rect(col2X, yPos, col3X - col2X - 2, rowHeight, 'F')
        doc.rect(col3X, yPos, col4X - col3X - 2, rowHeight, 'F')
        doc.rect(col4X, yPos, col5X - col4X - 2, rowHeight, 'F')
        doc.rect(col5X, yPos, pageWidth - col5X - 14, rowHeight, 'F')
        doc.text('datum', col1X + 2, yPos + 4)
        doc.text('aantal', col2X + 2, yPos + 4)
        doc.text('eendheden', col3X + 2, yPos + 4)
        doc.text('product', col4X + 2, yPos + 4)
        doc.text('signature', col5X + 2, yPos + 4)
        yPos += rowHeight
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
      }

      const dagdelen = calculateDagdelen(record.work_duration ?? undefined)
      totalDagdelen += dagdelen

      const dateObj = record.date ? new Date(record.date) : null
      const dateFormatted = dateObj
        ? dateObj.toLocaleDateString('nl-NL', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })
        : '-'

      const clockIn = record.clock_in
        ? new Date(record.clock_in).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
        : '-'
      const clockOut = record.clock_out
        ? new Date(record.clock_out).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
        : '-'
      const datumText = `${dateFormatted}\n${clockIn} - ${clockOut}`

      let currentRowHeight = rowHeight * 2
      if (record.signature_data) currentRowHeight = rowHeight * 4

      doc.setDrawColor(200, 200, 200)
      doc.rect(col1X, yPos, col2X - col1X - 2, currentRowHeight)
      doc.rect(col2X, yPos, col3X - col2X - 2, currentRowHeight)
      doc.rect(col3X, yPos, col4X - col3X - 2, currentRowHeight)
      doc.rect(col4X, yPos, col5X - col4X - 2, currentRowHeight)
      doc.rect(col5X, yPos, pageWidth - col5X - 14, currentRowHeight)

      doc.setFontSize(8)
      doc.text(datumText, col1X + 2, yPos + 2, { maxWidth: col2X - col1X - 4 })
      doc.setFontSize(9)
      doc.text(String(dagdelen), col2X + 2, yPos + 5)
      doc.text('dagdelen', col3X + 2, yPos + 5)

      doc.text(record.product || '-', col4X + 2, yPos + 5)

      if (record.signature_data) {
        const imgData = await renderSignatureImage(record.signature_data)
        if (imgData) {
          doc.addImage(imgData, 'PNG', col5X + 2, yPos + 2, 35, 10)
        }
      }

      yPos += currentRowHeight
    }

    yPos += 8
    doc.setFont('helvetica', 'bold')
    doc.text(`Totaal: ${totalDagdelen} dagdelen`, 14, yPos)
    yPos += 10
  }

  doc.save(`${selectedUser ?? 'Attendance'}_Report.pdf`)
}

export async function generateFloorplanPDF(layout: unknown, assignments: FloorplanLegendItem[]) {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Floorplan', 14, 20)

  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.width = '1200px'
  container.style.padding = '24px'
  container.style.background = '#ffffff'
  container.innerHTML = `<div id="floorplan-export"></div>`
  document.body.appendChild(container)

  const target = container.querySelector('#floorplan-export') as HTMLDivElement
  if (target) {
    target.innerHTML = ''
    target.setAttribute('data-floorplan', JSON.stringify(layout ?? {}))
  }

  const legend = document.createElement('div')
  legend.style.marginTop = '16px'
  legend.innerHTML = `
    <h3 style="margin-bottom: 8px;">Desk overview</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr>
          <th style="text-align: left; padding: 6px; border-bottom: 1px solid #e2e8f0;">User</th>
          <th style="text-align: left; padding: 6px; border-bottom: 1px solid #e2e8f0;">Desk</th>
          <th style="text-align: left; padding: 6px; border-bottom: 1px solid #e2e8f0;">Room</th>
          <th style="text-align: left; padding: 6px; border-bottom: 1px solid #e2e8f0;">Slot</th>
        </tr>
      </thead>
      <tbody>
        ${assignments
          .sort((a, b) => naturalDeskSort(a.desk, b.desk))
          .map(
            (row) => `
          <tr>
            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">${row.user}</td>
            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">${row.desk}</td>
            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">${row.room}</td>
            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">${row.slot}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `

  container.appendChild(legend)

  try {
    await new Promise((resolve) => setTimeout(resolve, 300))
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2 })
    const imgData = canvas.toDataURL('image/png')

    const imgWidth = pageWidth - 28
    const imgHeight = (canvas.height / canvas.width) * imgWidth

    doc.addImage(imgData, 'PNG', 14, 30, imgWidth, Math.min(imgHeight, pageHeight - 40))
    doc.save('Floorplan.pdf')
  } finally {
    document.body.removeChild(container)
  }
}
