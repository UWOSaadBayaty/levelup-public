// src/exportDocx.js
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

// force any value into plain string
const safeString = (val) => {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    if (val.$$typeof) return ""; // react element -> drop
    if (typeof val.text === "string") return val.text;
    try { return JSON.stringify(val); } catch { return ""; }
  }
  return String(val);
};

const heading = (text) =>
  new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } });

const bullet = (text) =>
  new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 60 } });

const normal = (text) =>
  new Paragraph({ text, spacing: { after: 80 } });

export async function exportResumeToDocx(cleanData, fileName = "resume") {
  const header = Array.isArray(cleanData?.header) ? cleanData.header.map(safeString) : [];
  const name = safeString(header[0] || "");
  const contact = header.slice(1).map(safeString).filter(Boolean).join(" • ");

  const summary = safeString(cleanData?.summary).trim();

  const education = Array.isArray(cleanData?.education) ? cleanData.education : [];
  const experience = Array.isArray(cleanData?.experience) ? cleanData.experience : [];
  const projects = Array.isArray(cleanData?.projects) ? cleanData.projects : [];
  const skills = Array.isArray(cleanData?.skills) ? cleanData.skills : [];

  const children = [];

  // HEADER
  if (name) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: name, bold: true, size: 34 })],
        spacing: { after: 80 },
      })
    );
  }
  if (contact) children.push(new Paragraph({ text: contact, spacing: { after: 200 } }));

  // SUMMARY
  if (summary) {
    children.push(heading("Summary"));
    children.push(normal(summary));
  }

  // EXPERIENCE
  if (experience.length) {
    children.push(heading("Experience"));
    experience.forEach((exp) => {
      const company = safeString(exp.company);
      const title = safeString(exp.title);
      const start = safeString(exp.start_date);
      const end = safeString(exp.end_date);
      const date = [start, end].filter(Boolean).join(" - ");

      const line1 = [title, company].filter(Boolean).join(" — ");
      const line2 = date;

      if (line1) children.push(new Paragraph({ children: [new TextRun({ text: line1, bold: true })] }));
      if (line2) children.push(new Paragraph({ text: line2, spacing: { after: 60 } }));

      const bullets = Array.isArray(exp.bullets) ? exp.bullets : [];
      bullets.map(safeString).filter(Boolean).forEach((b) => children.push(bullet(b)));

      children.push(new Paragraph({ text: "" })); // spacer
    });
  }

  // PROJECTS
  if (projects.length) {
    children.push(heading("Projects"));
    projects.forEach((p) => {
      const pname = safeString(p.name);
      const desc = safeString(p.description);

      if (pname) children.push(new Paragraph({ children: [new TextRun({ text: pname, bold: true })] }));
      if (desc) {
        // split lines into bullets if it looks like multiple points
        const lines = desc.split("\n").map((x) => x.trim()).filter(Boolean);
        if (lines.length > 1) lines.forEach((l) => children.push(bullet(l)));
        else children.push(normal(desc));
      }
      children.push(new Paragraph({ text: "" }));
    });
  }

  // EDUCATION
  if (education.length) {
    children.push(heading("Education"));
    education.forEach((e) => {
      const inst = safeString(e.institution);
      const degree = safeString(e.degree);
      const year = safeString(e.year);

      const top = [inst, year].filter(Boolean).join(" — ");
      if (top) children.push(new Paragraph({ children: [new TextRun({ text: top, bold: true })] }));
      if (degree) children.push(normal(degree));
    });
  }

  // SKILLS
  const skillLine = skills.map(safeString).filter(Boolean).join(", ");
  if (skillLine) {
    children.push(heading("Skills"));
    children.push(normal(skillLine));
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${safeString(fileName) || "resume"}_optimized.docx`);
}
