import type { Student } from './students';

export async function createBibPdf(students: Student[], perPage: 2 | 4, logoUrl: string) {
  if (!students.length) throw new Error('Aucun élève à imprimer.');
  const { jsPDF } = await import('jspdf');
  const logo = new Image();
  logo.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    logo.onload = () => resolve();
    logo.onerror = () => reject(new Error('La mascotte ne peut pas être chargée. Réessayez avant de générer les dossards.'));
    logo.src = logoUrl;
  });
  await document.fonts.ready;
  const pdf = new jsPDF({ orientation: perPage === 4 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: 'Dossards — Cross du collège', subject: 'Dossards des élèves', creator: 'Cross du collège' });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const cols = perPage === 4 ? 2 : 1;
  const tileWidth = (width - 20) / cols;
  const tileHeight = (height - 20) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = Math.round(1400 * tileHeight / tileWidth);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('La création PDF n’est pas disponible dans ce navigateur.');
  const fitText = (text: string, size: number, y: number, weight = '700') => {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    while (ctx.measureText(text).width > canvas.width - 100 && size > 8) {
      size -= 1;
      ctx.font = `${weight} ${size}px Arial, sans-serif`;
    }
    ctx.fillText(text, canvas.width / 2, y);
  };
  for (let index = 0; index < students.length; index++) {
    const student = students[index];
    if (!student) continue;
    const slot = index % perPage;
    if (index > 0 && slot === 0) pdf.addPage();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.drawImage(logo, 60, 40, 150, 150 * logo.height / logo.width);
    ctx.fillStyle = '#191c22';
    fitText('CROSS DU COLLÈGE', 30, 115, '600');
    fitText(student.bib, Math.min(390, canvas.height * 0.43), canvas.height * 0.48, '800');
    fitText(`${student.lastName.toUpperCase()} ${student.firstName}`, 64, canvas.height * 0.77);
    fitText(student.className, 48, canvas.height * 0.89, '400');
    const x = 10 + (slot % cols) * tileWidth;
    const y = 10 + Math.floor(slot / cols) * tileHeight;
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', x + 2, y + 2, tileWidth - 4, tileHeight - 4);
    pdf.setDrawColor(180);
    pdf.setLineWidth(0.15);
    pdf.setLineDashPattern([1.5, 1.5], 0);
    pdf.rect(x, y, tileWidth, tileHeight);
    if (index % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  return pdf;
}