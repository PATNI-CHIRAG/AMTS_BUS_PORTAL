import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { BookedTicket } from '../types';

/**
 * Generates an official AMTS Digital Transit E-Ticket PDF that is an exact 1:1 photorealistic
 * replica ("same to same") of the on-screen digital transit pass in TicketModal.
 * Directly stores the high-resolution PDF into the user's mobile device (Downloads folder).
 */
export async function downloadTicketPDF(ticket: BookedTicket): Promise<void> {
  const element = document.getElementById('amts-printable-ticket');
  if (!element) {
    console.error('Ticket DOM element #amts-printable-ticket not found for PDF export.');
    return;
  }

  try {
    // 1. Capture the exact on-screen ticket at high-DPI resolution (scale 3 = ~300 DPI)
    // Preserves all Gujarati typography, QR code, SVG icons, and precise colors
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
    });

    // 2. Calculate PDF dimensions in mm matching the exact aspect ratio of the captured ticket
    const imgData = canvas.toDataURL('image/png');
    const pdfWidth = 105; // Standard 105mm width (A6 portrait mobile format)
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    // 3. Create PDF with matching page size so there is no awkward white margin or clipping
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfWidth, pdfHeight],
    });

    doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

    // 4. Trigger download directly to user's mobile device / browser downloads
    const safeTicketNum = (ticket.ticket_number || 'TICKET').replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`AMTS_Ticket_${safeTicketNum}.pdf`);
  } catch (err) {
    console.error('html2canvas PDF generation failed:', err);
    throw err;
  }
}
