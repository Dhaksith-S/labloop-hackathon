"""Build the provisional report from its reviewed Markdown source.

Install documentation-only dependencies: python -m pip install reportlab pymupdf
Run: python scripts/build-report.py
Final PDF: output/pdf/LabLoop-Provisional-Report.pdf; QA renders: tmp/pdfs/.
"""
from pathlib import Path
from html import escape
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether,
)
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/pdf/LabLoop-Provisional-Report.pdf"
QA = ROOT / "tmp/pdfs"
OUT.parent.mkdir(parents=True, exist_ok=True)
QA.mkdir(parents=True, exist_ok=True)

FONT_DIRS = [Path("C:/Windows/Fonts"), Path("/usr/share/fonts/truetype/dejavu")]
regular = next((d / n for d in FONT_DIRS for n in ["arial.ttf", "DejaVuSans.ttf"] if (d / n).exists()), None)
bold = next((d / n for d in FONT_DIRS for n in ["arialbd.ttf", "DejaVuSans-Bold.ttf"] if (d / n).exists()), None)
if regular and bold:
    pdfmetrics.registerFont(TTFont("Report", str(regular)))
    pdfmetrics.registerFont(TTFont("ReportBold", str(bold)))
    pdfmetrics.registerFontFamily("Report", normal="Report", bold="ReportBold", italic="Report", boldItalic="ReportBold")
    BODY, BOLD = "Report", "ReportBold"
else:
    BODY, BOLD = "Helvetica", "Helvetica-Bold"

GREEN = colors.HexColor("#075e52")
INK = colors.HexColor("#182f2b")
MUTED = colors.HexColor("#5d706a")
PALE = colors.HexColor("#eff5f0")
GOLD = colors.HexColor("#9a6518")
RULE = colors.HexColor("#d7e1db")
WIDTH, HEIGHT = A4
LEFT = RIGHT = 44
CONTENT = WIDTH - LEFT - RIGHT

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="ReportBody", fontName=BODY, fontSize=9.3, leading=13,
                          textColor=INK, spaceAfter=6, splitLongWords=True))
styles.add(ParagraphStyle(name="ReportH1", fontName=BOLD, fontSize=17, leading=21,
                          textColor=GREEN, spaceBefore=16, spaceAfter=10, keepWithNext=True))
styles.add(ParagraphStyle(name="ReportH2", fontName=BOLD, fontSize=11.5, leading=16,
                          textColor=INK, spaceBefore=11, spaceAfter=7, keepWithNext=True))
styles.add(ParagraphStyle(name="Cell", parent=styles["ReportBody"], fontSize=8, leading=11,
                          spaceAfter=0))
styles.add(ParagraphStyle(name="CellHead", parent=styles["Cell"], fontName=BOLD,
                          textColor=colors.white))
styles.add(ParagraphStyle(name="ListItemReport", parent=styles["ReportBody"], leftIndent=13,
                          firstLineIndent=-10, spaceAfter=4))
styles.add(ParagraphStyle(name="Kicker", fontName=BOLD, fontSize=9, leading=13,
                          textColor=GREEN, spaceAfter=12))
styles.add(ParagraphStyle(name="CoverTitle", fontName=BOLD, fontSize=44, leading=49,
                          textColor=GREEN, spaceAfter=16))
styles.add(ParagraphStyle(name="CoverSubtitle", fontName=BODY, fontSize=20, leading=27,
                          textColor=INK, spaceAfter=18))
styles.add(ParagraphStyle(name="CoverBody", parent=styles["ReportBody"], fontSize=11,
                          leading=16, spaceAfter=14))


def normalize(value):
    for old, new in {"—": " - ", "–": "-", "‑": "-", "→": " -> ",
                     "←": "<-", "“": '"', "”": '"', "‘": "'", "’": "'", "…": "..."}.items():
        value = value.replace(old, new)
    return value


def inline(value):
    value = escape(normalize(value))
    value = value.replace("&lt;br/&gt;", "<br/>")
    value = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"`([^`]+)`", r'<font color="#075e52">\1</font>', value)
    value = re.sub(r"\[([^]]+)\]\((https?://[^)]+)\)", r'<link href="\2" color="#075e52">\1</link>', value)
    value = re.sub(r"&lt;(https?://[^&]+)&gt;", r'<link href="\1" color="#075e52">\1</link>', value)
    return value


def para(text, style="ReportBody"):
    return Paragraph(inline(text), styles[style])


def table(lines):
    rows = [[c.strip() for c in line.strip().strip("|").split("|")] for line in lines]
    rows = [row for row in rows if not all(re.fullmatch(r":?-+:?", c) for c in row)]
    n = len(rows[0])
    if n == 2:
        fractions = [0.32, 0.68]
    elif n == 3:
        fractions = [0.32, 0.13, 0.55] if "Points" in rows[0] else [0.24, 0.25, 0.51]
    elif n == 4:
        fractions = [0.23, 0.17, 0.2, 0.4]
    else:
        fractions = [1 / n] * n
    data = [[para(c, "CellHead" if i == 0 else "Cell") for c in row]
            for i, row in enumerate(rows)]
    result = Table(data, colWidths=[CONTENT * f for f in fractions], repeatRows=1, hAlign="LEFT")
    result.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, GREEN),
        ("LINEBELOW", (0, 1), (-1, -1), 0.3, RULE),
    ]))
    return [result, Spacer(1, 12)]


def architecture():
    drawing = Drawing(CONTENT, 104)
    labels = [("Browser", "Forms, catalog, timeline"),
              ("Next.js + services", "Auth, rules, human review"),
              ("SQLite + WAL", "Bookings, evidence, audit")]
    boxw = (CONTENT - 38) / 3
    for i, (title, detail) in enumerate(labels):
        x = i * (boxw + 19)
        drawing.add(Rect(x, 25, boxw, 65, rx=7, fillColor=PALE, strokeColor=RULE))
        drawing.add(String(x + 10, 66, title, fontName=BOLD, fontSize=10, fillColor=GREEN))
        drawing.add(String(x + 10, 46, detail, fontName=BODY, fontSize=7, fillColor=MUTED))
        if i < 2:
            end = x + boxw + 16
            drawing.add(Line(x + boxw + 3, 56, end, 56, strokeColor=GREEN))
            drawing.add(Polygon([end, 56, end - 4, 59, end - 4, 53], fillColor=GREEN, strokeColor=GREEN))
    drawing.add(String(0, 5, "Runtime architecture. Supabase SQL is prepared separately and is not connected.",
                       fontName=BODY, fontSize=7.5, fillColor=MUTED))
    return drawing


class ReportDoc(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == "ReportH1":
            title = flowable.getPlainText()
            key = "section-" + str(self.seq.nextf("section"))
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(title, key, 0)


def page_chrome(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(GREEN)
    canvas.rect(0, HEIGHT - 8, WIDTH, 8, fill=1, stroke=0)
    if doc.page == 1:
        canvas.setFillColor(PALE)
        canvas.rect(0, 0, WIDTH, HEIGHT - 8, fill=1, stroke=0)
    else:
        canvas.setFont(BOLD, 8)
        canvas.drawString(LEFT, HEIGHT - 30, "LABLOOP / PROJECT REPORT")
        canvas.setFillColor(GOLD)
        canvas.drawRightString(WIDTH - RIGHT, HEIGHT - 30, "PROVISIONAL")
    canvas.setStrokeColor(RULE)
    canvas.line(LEFT, 38, WIDTH - RIGHT, 38)
    canvas.setFillColor(MUTED)
    canvas.setFont(BODY, 7)
    canvas.drawString(LEFT, 25, "30 OCT 2026  |  Fictional demonstration data  |  Public demo under acceptance")
    canvas.drawRightString(WIDTH - RIGHT, 25, f"{doc.page}")
    canvas.restoreState()


story = [Spacer(1, 42), para("HACKATHON / 48-HOUR BUILD", "Kicker"),
         para("LabLoop", "CoverTitle"),
         para("Unlock underused equipment<br/>and spaces.", "CoverSubtitle"),
         para("Trusted campus sharing, from eligibility and human approval to condition evidence and return.", "CoverBody"),
         Spacer(1, 18)]
status = Table([[para("**PROVISIONAL - NOT SUBMISSION READY**", "CoverBody")],
                [para("Local product and public custody workflow verified. Final restart/device acceptance, official PDF template and verified team details remain pending.")]], colWidths=[CONTENT])
status.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff4dd")),
                           ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#d9b879")),
                           ("LEFTPADDING", (0, 0), (-1, -1), 16),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 16),
                           ("TOPPADDING", (0, 0), (-1, -1), 12),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
story.extend([status, Spacer(1, 25)])
for title, value in [
    ("Selected use case", "Campus resource sharing at fictional Northstar Institute of Applied Technology"),
    ("Runtime", "Next.js 16 + React 19 + TypeScript + persistent local SQLite"),
    ("Official deadline", "1 November 2026, 10:00 AM IST"),
    ("Source repository", "https://github.com/Dhaksith-S/labloop-hackathon"),
]:
    story.extend([para(f"**{title}**"), para(value), Spacer(1, 3)])
story.extend([Spacer(1, 12), para("Team: [TO BE CONFIRMED]  /  Participant IDs and actual contributions: pending"), PageBreak()])

lines = (ROOT / "docs/HACKATHON_REPORT.md").read_text(encoding="utf-8").splitlines()
i = 1  # The Markdown title is represented by the cover.
while i < len(lines):
    line = lines[i].strip()
    if not line or line == "---":
        i += 1
        continue
    if line.startswith("|"):
        block = []
        while i < len(lines) and lines[i].strip().startswith("|"):
            block.append(lines[i].strip())
            i += 1
        story.extend(table(block))
        continue
    if line.startswith("## "):
        story.append(para(line[3:], "ReportH1"))
    elif line.startswith("### "):
        story.append(para(line[4:], "ReportH2"))
        if line[4:] == "Architecture and technology stack":
            story.append(architecture())
    elif re.match(r"^(?:- |\d+\. )", line):
        story.append(para(line, "ListItemReport"))
    else:
        paragraph = [line]
        while i + 1 < len(lines):
            following = lines[i + 1].strip()
            if not following or following.startswith(("#", "|", "- ")) or re.match(r"^\d+\. ", following):
                break
            i += 1
            paragraph.append(following)
        story.append(para(" ".join(paragraph)))
    i += 1

# Keep the short team declaration/table together instead of splitting placeholders.
team_start = next(i for i, flow in enumerate(story) if isinstance(flow, Paragraph)
                  and flow.style.name == "ReportH1" and flow.getPlainText().startswith("14."))
team_end = next(i for i in range(team_start + 1, len(story)) if isinstance(story[i], Paragraph)
                and story[i].style.name == "ReportH1")
story[team_start:team_end] = [KeepTogether(story[team_start:team_end])]

doc = ReportDoc(str(OUT), pagesize=A4, leftMargin=LEFT, rightMargin=RIGHT,
                topMargin=49, bottomMargin=53, title="LabLoop - Provisional Hackathon Project Report",
                author="LabLoop project - participant identities pending", subject="Provisional report; official template unavailable")
doc.addPageTemplates(PageTemplate(id="report", frames=Frame(LEFT, 53, CONTENT, HEIGHT - 102,
                                                            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0),
                                 onPage=page_chrome))
doc.build(story)
print(f"Created {OUT}")

# Prefer Poppler when installed. PyMuPDF is the local rendering fallback here.
import pymupdf
from PIL import Image, ImageDraw
pdf = pymupdf.open(OUT)
thumbs = []
for index, page in enumerate(pdf):
    image_path = QA / f"report-page-{index + 1:02}.png"
    page.get_pixmap(matrix=pymupdf.Matrix(1.3, 1.3), alpha=False).save(image_path)
    thumbnail = Image.open(image_path).convert("RGB")
    thumbnail.thumbnail((298, 422))
    card = Image.new("RGB", (318, 454), "#dce4df")
    card.paste(thumbnail, ((318 - thumbnail.width) // 2, 8))
    ImageDraw.Draw(card).text((12, 433), f"PAGE {index + 1}", fill="#183c32")
    thumbs.append(card)
columns = 3
rows = (len(thumbs) + columns - 1) // columns
sheet = Image.new("RGB", (columns * 318, rows * 454), "white")
for index, thumb in enumerate(thumbs):
    sheet.paste(thumb, ((index % columns) * 318, (index // columns) * 454))
sheet.save(QA / "report-contact-sheet.png")
text = "\n".join(page.get_text() for page in pdf)
for expected in ["PROVISIONAL", "44", "5 tests", "Participant", "DeepSeek", "Codex", "100", "15. Libraries"]:
    if expected not in text:
        raise RuntimeError(f"Missing expected report content: {expected}")
print(f"Rendered {len(pdf)} pages for visual QA in {QA}")
print("Text/content checks passed. Inspect the page renders before delivery.")
