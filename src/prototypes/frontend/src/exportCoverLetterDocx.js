import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

export async function exportCoverLetterToDocx(text, filename = "cover_letter") {
  const lines = String(text || "").replace(/\r/g, "").split("\n");

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: lines.map((line) => new Paragraph({
          children: [new TextRun(line)],
        })),
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}
